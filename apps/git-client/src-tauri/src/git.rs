use std::{
    collections::{BTreeSet, HashMap},
    path::{Component, Path, PathBuf},
    process::Stdio,
    sync::{Arc, Mutex, RwLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use notify_debouncer_mini::{
    Debouncer, new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
};
use tauri::ipc::Channel;
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::Command,
    sync::{Mutex as AsyncMutex, mpsc},
    time::{Instant as TokioInstant, sleep_until},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    model::{
        AbortableOperation, ContinuableOperation, GitEvent, GitOperation, GitRequest, GitVersion,
        InProgressOperation, LogOrder, OutputStream, RepositoryChangedEvent, RepositoryId,
        RepositoryInvalidation, RepositorySnapshot, RequestId, ResetMode, SkippableOperation,
        StashShowMode,
    },
};

const MINIMUM_GIT_MAJOR: u16 = 2;
const MINIMUM_GIT_MINOR: u16 = 39;
const QUERY_TIMEOUT: Duration = Duration::from_secs(120);
const OPERATION_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const CHUNK_SIZE: usize = 32 * 1024;

#[derive(Clone)]
pub(crate) struct RepositoryRecord {
    pub(crate) path: PathBuf,
    git_directory: PathBuf,
    common_directory: PathBuf,
    pub(crate) operation_lock: Arc<AsyncMutex<()>>,
}

#[derive(Default)]
pub struct AppState {
    repositories: Arc<RwLock<HashMap<String, RepositoryRecord>>>,
    cancellations: Arc<Mutex<HashMap<String, CancellationToken>>>,
    watchers: Mutex<HashMap<String, Debouncer<RecommendedWatcher>>>,
}

struct CommandSpec {
    args: Vec<String>,
    env: Vec<(String, String)>,
    stdin: Option<Vec<u8>>,
    mutation: bool,
    timeout: Duration,
}

impl CommandSpec {
    fn query(args: Vec<String>) -> Self {
        Self {
            args,
            env: vec![("GIT_OPTIONAL_LOCKS".into(), "0".into())],
            stdin: None,
            mutation: false,
            timeout: QUERY_TIMEOUT,
        }
    }

    fn mutation(args: Vec<String>) -> Self {
        Self {
            args,
            env: Vec::new(),
            stdin: None,
            mutation: true,
            timeout: OPERATION_TIMEOUT,
        }
    }

    fn with_stdin(mut self, value: Vec<u8>) -> Self {
        self.stdin = Some(value);
        self
    }

    fn with_env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env.push((key.into(), value.into()));
        self
    }
}

struct OutputChunk {
    stream: OutputStream,
    data: Vec<u8>,
}

#[tauri::command]
pub async fn open_repository(
    path: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<RepositorySnapshot> {
    let (snapshot, root) = inspect_repository(Path::new(&path)).await?;
    state
        .repositories
        .write()
        .expect("repository lock poisoned")
        .insert(
            snapshot.id.0.clone(),
            repository_record_from(snapshot.clone(), root),
        );
    Ok(snapshot)
}

#[tauri::command]
pub async fn initialize_repository(
    path: String,
    bare: bool,
    state: tauri::State<'_, AppState>,
) -> AppResult<RepositorySnapshot> {
    validate_worktree_path(&path)?;
    let destination = PathBuf::from(&path);
    if let Some(parent) = destination.parent() {
        fs_create_dir_all(parent)?;
    }
    let mut command = Command::new("git");
    command.arg("init");
    if bare {
        command.arg("--bare");
    } else {
        command.arg("--initial-branch=main");
    }
    command
        .arg(&destination)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    run_global_command(command).await?;
    register_repository(&destination, &state).await
}

#[tauri::command]
pub async fn clone_repository(
    url: String,
    path: String,
    depth: Option<u16>,
    state: tauri::State<'_, AppState>,
) -> AppResult<RepositorySnapshot> {
    validate_url(&url)?;
    validate_worktree_path(&path)?;
    let destination = PathBuf::from(&path);
    if destination.exists()
        && destination
            .read_dir()
            .is_ok_and(|mut entries| entries.next().is_some())
    {
        return Err(invalid("path", "clone destination must be empty"));
    }
    let mut command = Command::new("git");
    command.args(["clone", "--origin", "origin"]);
    if let Some(depth) = depth {
        if depth == 0 {
            return Err(invalid("depth", "must be greater than zero"));
        }
        command.args(["--depth", &depth.to_string()]);
    }
    command
        .args([&url, &path])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    run_global_command(command).await?;
    register_repository(&destination, &state).await
}

#[tauri::command]
pub async fn refresh_repository(
    repository_id: RepositoryId,
    state: tauri::State<'_, AppState>,
) -> AppResult<RepositorySnapshot> {
    let record = repository_record(&state, &repository_id)?;
    let (snapshot, _) = inspect_repository(&record.path).await?;
    Ok(snapshot)
}

async fn register_repository(path: &Path, state: &AppState) -> AppResult<RepositorySnapshot> {
    let (snapshot, root) = inspect_repository(path).await?;
    state
        .repositories
        .write()
        .expect("repository lock poisoned")
        .insert(
            snapshot.id.0.clone(),
            repository_record_from(snapshot.clone(), root),
        );
    Ok(snapshot)
}

fn repository_record_from(snapshot: RepositorySnapshot, path: PathBuf) -> RepositoryRecord {
    RepositoryRecord {
        path,
        git_directory: PathBuf::from(snapshot.git_directory),
        common_directory: PathBuf::from(snapshot.common_directory),
        operation_lock: Arc::new(AsyncMutex::new(())),
    }
}

async fn run_global_command(mut command: Command) -> AppResult<()> {
    let output = tokio::time::timeout(OPERATION_TIMEOUT, command.output())
        .await
        .map_err(|_| AppError::CommandFailed("Git command timed out".into()))??;
    if output.status.success() {
        Ok(())
    } else {
        Err(AppError::CommandFailed(redact_credentials(
            String::from_utf8_lossy(&output.stderr).trim(),
        )))
    }
}

fn fs_create_dir_all(path: &Path) -> AppResult<()> {
    std::fs::create_dir_all(path)?;
    Ok(())
}

#[tauri::command]
pub async fn execute(
    request: GitRequest,
    on_event: Channel<GitEvent>,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<RequestId> {
    let record = repository_record(&state, request.repository_id())?;
    let repository_id = request.repository_id().clone();
    let recovery_operation = match &request {
        GitRequest::Operation { operation, .. } => Some(operation.clone()),
        _ => None,
    };
    let spec = command_for_request(&request)?;
    let request_id = RequestId(Uuid::new_v4().to_string());
    let cancellation = CancellationToken::new();
    state
        .cancellations
        .lock()
        .expect("cancellation lock poisoned")
        .insert(request_id.0.clone(), cancellation.clone());

    let request_id_for_task = request_id.clone();
    let cancellations = state.inner().cancellations.clone();
    tauri::async_runtime::spawn(async move {
        let _operation_guard = if spec.mutation {
            Some(record.operation_lock.lock().await)
        } else {
            None
        };
        if let Some(operation) = recovery_operation
            && let Err(error) = crate::recovery::record_before_operation(
                &app,
                &repository_id,
                &record.path,
                &operation,
            )
            .await
        {
            let _ = on_event.send(GitEvent::Failed {
                request_id: request_id_for_task.clone(),
                message: format!("Could not create recovery entry: {error}"),
                exit_code: None,
                duration_ms: 0,
            });
            cancellations
                .lock()
                .expect("cancellation lock poisoned")
                .remove(&request_id_for_task.0);
            return;
        }
        run_streaming(
            &record.path,
            spec,
            request_id_for_task.clone(),
            cancellation,
            on_event,
        )
        .await;
        cancellations
            .lock()
            .expect("cancellation lock poisoned")
            .remove(&request_id_for_task.0);
    });

    Ok(request_id)
}

#[tauri::command]
pub fn cancel(request_id: RequestId, state: tauri::State<'_, AppState>) -> AppResult<()> {
    let cancellation = state
        .cancellations
        .lock()
        .expect("cancellation lock poisoned")
        .get(&request_id.0)
        .cloned();
    if let Some(cancellation) = cancellation {
        cancellation.cancel();
    }
    Ok(())
}

#[tauri::command]
pub fn watch_repository(
    repository_id: RepositoryId,
    on_event: Channel<RepositoryChangedEvent>,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    let record = repository_record(&state, &repository_id)?;
    let event_repository_id = repository_id.clone();
    let debouncer = create_repository_watcher(&record, move |invalidations| {
        let _ = on_event.send(RepositoryChangedEvent {
            repository_id: event_repository_id.clone(),
            invalidations,
        });
    })?;
    state
        .watchers
        .lock()
        .expect("watcher lock poisoned")
        .insert(repository_id.0, debouncer);
    Ok(())
}

fn create_repository_watcher(
    record: &RepositoryRecord,
    on_event: impl Fn(Vec<RepositoryInvalidation>) + Send + 'static,
) -> AppResult<Debouncer<RecommendedWatcher>> {
    let root = record.path.clone();
    let git_directory = record.git_directory.clone();
    let common_directory = record.common_directory.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(250),
        move |result: notify_debouncer_mini::DebounceEventResult| {
            if let Ok(events) = result {
                let invalidations = events
                    .into_iter()
                    .flat_map(|event| {
                        classify_repository_path(
                            &root,
                            &git_directory,
                            &common_directory,
                            &event.path,
                        )
                    })
                    .collect::<BTreeSet<_>>()
                    .into_iter()
                    .collect::<Vec<_>>();
                if !invalidations.is_empty() {
                    on_event(invalidations);
                }
            }
        },
    )
    .map_err(|error| AppError::Io(std::io::Error::other(error)))?;
    let mut watched_roots = Vec::<PathBuf>::new();
    for path in [
        &record.path,
        &record.common_directory,
        &record.git_directory,
    ] {
        if watched_roots.iter().any(|root| path.starts_with(root)) {
            continue;
        }
        debouncer
            .watcher()
            .watch(path, RecursiveMode::Recursive)
            .map_err(|error| AppError::Io(std::io::Error::other(error)))?;
        watched_roots.push(path.clone());
    }
    Ok(debouncer)
}

fn classify_repository_path(
    root: &Path,
    git_directory: &Path,
    common_directory: &Path,
    path: &Path,
) -> Vec<RepositoryInvalidation> {
    let metadata_path = path
        .strip_prefix(git_directory)
        .ok()
        .map(|path| (path, true))
        .or_else(|| {
            path.strip_prefix(common_directory)
                .ok()
                .map(|path| (path, false))
        });
    if let Some((relative, current_worktree)) = metadata_path {
        let value = relative.to_string_lossy();
        if value.ends_with(".lock")
            || relative.starts_with("objects")
            || relative.starts_with("logs")
        {
            return Vec::new();
        }
        if relative == Path::new("index") {
            return vec![RepositoryInvalidation::Status];
        }
        if relative == Path::new("refs/stash") {
            return vec![
                RepositoryInvalidation::Status,
                RepositoryInvalidation::History,
                RepositoryInvalidation::Stash,
            ];
        }
        if relative == Path::new("HEAD") {
            return vec![
                RepositoryInvalidation::Status,
                RepositoryInvalidation::History,
            ];
        }
        if relative == Path::new("packed-refs")
            || relative == Path::new("shallow")
            || relative.starts_with("refs")
        {
            return vec![RepositoryInvalidation::History];
        }
        if is_operation_metadata(relative) {
            return vec![
                RepositoryInvalidation::Status,
                RepositoryInvalidation::Operation,
            ];
        }
        if relative == Path::new("config")
            || relative == Path::new("config.worktree")
            || (!current_worktree && relative.starts_with("worktrees"))
        {
            return vec![RepositoryInvalidation::Management];
        }
        return Vec::new();
    }
    path.starts_with(root)
        .then_some(RepositoryInvalidation::Status)
        .into_iter()
        .collect()
}

fn is_operation_metadata(path: &Path) -> bool {
    matches!(
        path.to_string_lossy().as_ref(),
        "MERGE_HEAD" | "CHERRY_PICK_HEAD" | "REVERT_HEAD" | "BISECT_LOG" | "AUTO_MERGE"
    ) || path.starts_with("rebase-merge")
        || path.starts_with("rebase-apply")
        || path.starts_with("sequencer")
}

#[tauri::command]
pub fn unwatch_repository(
    repository_id: RepositoryId,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    state
        .watchers
        .lock()
        .expect("watcher lock poisoned")
        .remove(&repository_id.0);
    Ok(())
}

pub(crate) fn repository_record(
    state: &AppState,
    id: &RepositoryId,
) -> AppResult<RepositoryRecord> {
    state
        .repositories
        .read()
        .expect("repository lock poisoned")
        .get(&id.0)
        .cloned()
        .ok_or(AppError::RepositoryNotOpen)
}

async fn inspect_repository(path: &Path) -> AppResult<(RepositorySnapshot, PathBuf)> {
    let git_version = detect_git_version().await?;
    let canonical_input = path
        .canonicalize()
        .map_err(|error| AppError::NotRepository(format!("{} ({error})", path.display())))?;
    if !canonical_input.is_dir() {
        return Err(AppError::NotRepository(path.display().to_string()));
    }

    let is_bare = capture_required(&canonical_input, &["rev-parse", "--is-bare-repository"])
        .await?
        .trim()
        == "true";
    let root = if is_bare {
        canonical_input.clone()
    } else {
        PathBuf::from(
            capture_required(&canonical_input, &["rev-parse", "--show-toplevel"])
                .await?
                .trim(),
        )
        .canonicalize()?
    };
    let git_directory = absolute_git_path(
        &root,
        &capture_required(&root, &["rev-parse", "--absolute-git-dir"]).await?,
    )?;
    let common_directory = absolute_git_path(
        &root,
        &capture_required(&root, &["rev-parse", "--git-common-dir"]).await?,
    )?;
    let has_commits = capture_optional(&root, &["rev-parse", "--verify", "HEAD"])
        .await
        .is_some();
    let current_branch = capture_optional(&root, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .await
        .map(trimmed);
    let head_oid = capture_optional(&root, &["rev-parse", "--verify", "HEAD"])
        .await
        .map(trimmed);
    let upstream = capture_optional(
        &root,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    )
    .await
    .map(trimmed);
    let remote_url = capture_optional(&root, &["remote", "get-url", "origin"])
        .await
        .map(trimmed);
    let (ahead, behind) = if upstream.is_some() && has_commits {
        capture_optional(
            &root,
            &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
        )
        .await
        .and_then(|value| {
            let mut fields = value.split_whitespace();
            Some((fields.next()?.parse().ok()?, fields.next()?.parse().ok()?))
        })
        .unwrap_or((0, 0))
    } else {
        (0, 0)
    };
    let is_shallow = capture_optional(&root, &["rev-parse", "--is-shallow-repository"])
        .await
        .is_some_and(|value| value.trim() == "true");
    let operation = detect_operation(&git_directory, &common_directory);
    let id = RepositoryId(
        Uuid::new_v5(&Uuid::NAMESPACE_URL, root.to_string_lossy().as_bytes()).to_string(),
    );
    let name = root
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Repository")
        .to_owned();

    Ok((
        RepositorySnapshot {
            id,
            name,
            path: root.to_string_lossy().into_owned(),
            git_directory: git_directory.to_string_lossy().into_owned(),
            common_directory: common_directory.to_string_lossy().into_owned(),
            current_branch,
            head_oid,
            upstream,
            remote_url,
            ahead,
            behind,
            is_bare,
            is_shallow,
            is_detached: has_commits
                && capture_optional(&root, &["symbolic-ref", "--quiet", "HEAD"])
                    .await
                    .is_none(),
            has_commits,
            operation,
            git_version,
        },
        root,
    ))
}

async fn detect_git_version() -> AppResult<GitVersion> {
    let output = Command::new("git")
        .arg("--version")
        .output()
        .await
        .map_err(|error| AppError::GitUnavailable(error.to_string()))?;
    if !output.status.success() {
        return Err(AppError::GitUnavailable(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }
    let display = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    let version_token = display
        .split_whitespace()
        .find(|part| {
            part.chars()
                .next()
                .is_some_and(|character| character.is_ascii_digit())
        })
        .ok_or_else(|| AppError::GitUnavailable(display.clone()))?;
    let mut parts = version_token.split('.');
    let major = numeric_prefix(parts.next().unwrap_or_default());
    let minor = numeric_prefix(parts.next().unwrap_or_default());
    let patch = numeric_prefix(parts.next().unwrap_or_default());
    if (major, minor) < (MINIMUM_GIT_MAJOR, MINIMUM_GIT_MINOR) {
        return Err(AppError::UnsupportedGit(display));
    }
    Ok(GitVersion {
        major,
        minor,
        patch,
        display,
    })
}

fn numeric_prefix(value: &str) -> u16 {
    value
        .chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>()
        .parse()
        .unwrap_or_default()
}

fn absolute_git_path(root: &Path, value: &str) -> AppResult<PathBuf> {
    let path = PathBuf::from(value.trim());
    let path = if path.is_absolute() {
        path
    } else {
        root.join(path)
    };
    Ok(path.canonicalize()?)
}

fn detect_operation(git_directory: &Path, common_directory: &Path) -> Option<InProgressOperation> {
    if git_directory.join("rebase-merge").exists() || git_directory.join("rebase-apply").exists() {
        Some(InProgressOperation::Rebase)
    } else if git_directory.join("MERGE_HEAD").exists() {
        Some(InProgressOperation::Merge)
    } else if git_directory.join("CHERRY_PICK_HEAD").exists() {
        Some(InProgressOperation::CherryPick)
    } else if git_directory.join("REVERT_HEAD").exists() {
        Some(InProgressOperation::Revert)
    } else if common_directory.join("BISECT_LOG").exists() {
        Some(InProgressOperation::Bisect)
    } else {
        None
    }
}

async fn capture_required(path: &Path, args: &[&str]) -> AppResult<String> {
    let output = git_command(path, args).output().await?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(AppError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

async fn capture_optional(path: &Path, args: &[&str]) -> Option<String> {
    let output = git_command(path, args).output().await.ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

fn git_command(path: &Path, args: &[&str]) -> Command {
    let mut command = Command::new("git");
    command
        .args(args)
        .current_dir(path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command
}

fn trimmed(value: String) -> String {
    value.trim().to_owned()
}

async fn run_streaming(
    path: &Path,
    spec: CommandSpec,
    request_id: RequestId,
    cancellation: CancellationToken,
    on_event: Channel<GitEvent>,
) {
    let started = Instant::now();
    let started_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let display_command = display_command(&spec.args);
    let _ = on_event.send(GitEvent::Started {
        request_id: request_id.clone(),
        display_command,
        started_at_ms,
    });

    let mut command = Command::new("git");
    command
        .args(&spec.args)
        .current_dir(path)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("LC_ALL", "C")
        .envs(spec.env.iter().map(|(key, value)| (key, value)))
        .stdin(if spec.stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let _ = on_event.send(GitEvent::Failed {
                request_id,
                message: error.to_string(),
                exit_code: None,
                duration_ms: started.elapsed().as_millis() as u64,
            });
            return;
        }
    };
    if let Some(input) = spec.stdin
        && let Some(mut stdin) = child.stdin.take()
    {
        tauri::async_runtime::spawn(async move {
            let _ = stdin.write_all(&input).await;
        });
    }

    let (chunk_sender, mut chunk_receiver) = mpsc::channel::<OutputChunk>(16);
    if let Some(stdout) = child.stdout.take() {
        spawn_reader(stdout, OutputStream::Stdout, chunk_sender.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_reader(stderr, OutputStream::Stderr, chunk_sender.clone());
    }
    drop(chunk_sender);

    let deadline = sleep_until(TokioInstant::now() + spec.timeout);
    tokio::pin!(deadline);
    let mut sequence = 0_u64;
    let mut pipe_open = true;
    let outcome = loop {
        tokio::select! {
            chunk = chunk_receiver.recv(), if pipe_open => {
                if let Some(chunk) = chunk {
                    let _ = on_event.send(GitEvent::Output {
                        request_id: request_id.clone(),
                        sequence,
                        stream: chunk.stream,
                        data: redact_credentials(&String::from_utf8_lossy(&chunk.data)),
                    });
                    sequence += 1;
                } else {
                    pipe_open = false;
                }
            }
            status = child.wait() => break status.map(Some),
            () = cancellation.cancelled() => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                break Ok(None);
            }
            () = &mut deadline => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                break Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "Git command timed out"));
            }
        }
    };

    while let Some(chunk) = chunk_receiver.recv().await {
        let _ = on_event.send(GitEvent::Output {
            request_id: request_id.clone(),
            sequence,
            stream: chunk.stream,
            data: redact_credentials(&String::from_utf8_lossy(&chunk.data)),
        });
        sequence += 1;
    }
    let duration_ms = started.elapsed().as_millis() as u64;
    match outcome {
        Ok(None) => {
            let _ = on_event.send(GitEvent::Cancelled {
                request_id,
                duration_ms,
            });
        }
        Ok(Some(status)) if status.success() => {
            let _ = on_event.send(GitEvent::Completed {
                request_id,
                exit_code: status.code().unwrap_or_default(),
                duration_ms,
            });
        }
        Ok(Some(status)) => {
            let _ = on_event.send(GitEvent::Failed {
                request_id,
                message: format!("Git exited with status {}", status.code().unwrap_or(-1)),
                exit_code: status.code(),
                duration_ms,
            });
        }
        Err(error) => {
            let _ = on_event.send(GitEvent::Failed {
                request_id,
                message: error.to_string(),
                exit_code: None,
                duration_ms,
            });
        }
    }
}

fn spawn_reader(
    mut reader: impl AsyncRead + Unpin + Send + 'static,
    stream: OutputStream,
    sender: mpsc::Sender<OutputChunk>,
) {
    tauri::async_runtime::spawn(async move {
        loop {
            let mut buffer = vec![0; CHUNK_SIZE];
            match reader.read(&mut buffer).await {
                Ok(0) | Err(_) => break,
                Ok(read) => {
                    buffer.truncate(read);
                    if sender
                        .send(OutputChunk {
                            stream: stream.clone(),
                            data: buffer,
                        })
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
            }
        }
    });
}

fn command_for_request(request: &GitRequest) -> AppResult<CommandSpec> {
    match request {
        GitRequest::Status { .. } => Ok(CommandSpec::query(strings(&[
            "status",
            "--porcelain=v2",
            "-z",
            "--branch",
            "--show-stash",
            "--untracked-files=all",
        ]))),
        GitRequest::Refs { .. } => Ok(CommandSpec::query(strings(&[
            "for-each-ref",
            "--sort=refname",
            "--format=%(refname)%00%(objectname)%00%(objecttype)%00%(HEAD)%00%(upstream)%00%(upstream:track)%00%(subject)%00%(authorname)%00%(authordate:unix)%00",
            "refs/heads",
            "refs/remotes",
            "refs/tags",
        ]))),
        GitRequest::Log {
            skip,
            limit,
            order,
            filters,
            ..
        } => {
            let mut args = strings(&[
                "log",
                "--all",
                "--no-color",
                "--decorate=full",
                "--format=%x1e%H%x00%P%x00%an%x00%ae%x00%at%x00%ct%x00%D%x00%s%x00%b%x00",
            ]);
            args.push(format!("--skip={skip}"));
            args.push(format!("--max-count={}", (*limit).clamp(1, 500)));
            match order {
                LogOrder::Date => args.push("--date-order".into()),
                LogOrder::Topology => args.push("--topo-order".into()),
                LogOrder::FirstParent => args.push("--first-parent".into()),
            }
            if filters.no_merges {
                args.push("--no-merges".into());
            }
            if let Some(query) = &filters.query {
                validate_text(query, "query")?;
                args.extend(["--regexp-ignore-case".into(), format!("--grep={query}")]);
            }
            if let Some(author) = &filters.author {
                validate_text(author, "author")?;
                args.push(format!("--author={author}"));
            }
            if let Some(since) = &filters.since {
                validate_text(since, "since")?;
                args.push(format!("--since={since}"));
            }
            if let Some(until) = &filters.until {
                validate_text(until, "until")?;
                args.push(format!("--until={until}"));
            }
            if let Some(branch) = &filters.branch {
                validate_revision(branch, "branch")?;
                args.push(branch.clone());
            }
            append_paths(&mut args, &filters.paths)?;
            Ok(CommandSpec::query(args))
        }
        GitRequest::CommitDetails { revision, .. } => {
            validate_revision(revision, "revision")?;
            Ok(CommandSpec::query(vec![
                "show".into(),
                "--no-color".into(),
                "--no-ext-diff".into(),
                "--find-renames".into(),
                "--format=%H%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ce%x00%ct%x00%D%x00%B%x00"
                    .into(),
                "--numstat".into(),
                "-z".into(),
                revision.clone(),
                "--".into(),
            ]))
        }
        GitRequest::Diff {
            from,
            to,
            paths,
            staged,
            ..
        } => {
            let mut args = strings(&[
                "diff",
                "--no-color",
                "--no-ext-diff",
                "--find-renames",
                "--find-copies",
                "--patch",
            ]);
            if *staged {
                args.push("--cached".into());
            }
            for revision in [from, to].into_iter().flatten() {
                validate_revision(revision, "revision")?;
                args.push(revision.clone());
            }
            append_paths(&mut args, paths)?;
            Ok(CommandSpec::query(args))
        }
        GitRequest::Tree { revision, path, .. } => {
            validate_revision(revision, "revision")?;
            let treeish = if let Some(path) = path {
                validate_relative_path(path)?;
                format!("{revision}:{path}")
            } else {
                revision.clone()
            };
            let args = strings(&["ls-tree", "-z", "-l", "--full-name", &treeish]);
            Ok(CommandSpec::query(args))
        }
        GitRequest::FileHistory {
            path, skip, limit, ..
        } => {
            validate_relative_path(path)?;
            Ok(CommandSpec::query(vec![
                "log".into(),
                "--follow".into(),
                "--no-color".into(),
                "--format=%x1e%H%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s%x00".into(),
                format!("--skip={skip}"),
                format!("--max-count={}", (*limit).clamp(1, 500)),
                "--".into(),
                path.clone(),
            ]))
        }
        GitRequest::Blame { revision, path, .. } => {
            validate_relative_path(path)?;
            let mut args = strings(&["blame", "--line-porcelain"]);
            if let Some(revision) = revision {
                validate_revision(revision, "revision")?;
                args.push(revision.clone());
            }
            args.extend(["--".into(), path.clone()]);
            Ok(CommandSpec::query(args))
        }
        GitRequest::StashList { .. } => Ok(CommandSpec::query(strings(&[
            "stash",
            "list",
            "--format=%x1e%gd%x00%H%x00%gs%x00%an%x00%ae%x00%at%x00",
        ]))),
        GitRequest::StashShow { stash, mode, .. } => {
            validate_revision(stash, "stash")?;
            let args = match mode {
                StashShowMode::Files => strings(&[
                    "stash",
                    "show",
                    "--include-untracked",
                    "--name-status",
                    "-z",
                    stash,
                ]),
                StashShowMode::Patch => strings(&[
                    "stash",
                    "show",
                    "--include-untracked",
                    "--patch",
                    "--no-color",
                    stash,
                ]),
            };
            Ok(CommandSpec::query(args))
        }
        GitRequest::Operation { operation, .. } => command_for_operation(operation),
    }
}

fn command_for_operation(operation: &GitOperation) -> AppResult<CommandSpec> {
    let mut args = Vec::new();
    match operation {
        GitOperation::Stage { paths } => {
            args.extend(strings(&["add"]));
            append_nonempty_paths(&mut args, paths)?;
        }
        GitOperation::Unstage { paths } => {
            args.extend(strings(&["restore", "--staged"]));
            append_nonempty_paths(&mut args, paths)?;
        }
        GitOperation::Discard { paths } => {
            args.extend(strings(&["restore", "--worktree"]));
            append_nonempty_paths(&mut args, paths)?;
        }
        GitOperation::ApplyPatch {
            patch,
            cached,
            reverse,
        } => {
            validate_text(patch, "patch")?;
            args.extend(strings(&["apply", "--3way", "--whitespace=nowarn"]));
            if *cached {
                args.push("--cached".into());
            }
            if *reverse {
                args.push("--reverse".into());
            }
            args.push("-".into());
            return Ok(CommandSpec::mutation(args).with_stdin(patch.as_bytes().to_vec()));
        }
        GitOperation::PartialPatch {
            patch,
            cached,
            reverse,
        } => {
            validate_text(patch, "patch")?;
            if patch.len() > 5 * 1024 * 1024 {
                return Err(invalid("patch", "must not exceed 5 MiB"));
            }
            args.extend(strings(&["apply", "--unidiff-zero", "--whitespace=nowarn"]));
            if *cached {
                args.push("--cached".into());
            }
            if *reverse {
                args.push("--reverse".into());
            }
            args.push("-".into());
            return Ok(CommandSpec::mutation(args).with_stdin(patch.as_bytes().to_vec()));
        }
        GitOperation::Commit {
            message,
            amend,
            sign_off,
            gpg_sign,
        } => {
            if message.trim().is_empty() {
                return Err(invalid("message", "must not be empty"));
            }
            validate_text(message, "message")?;
            args.extend(strings(&["commit", "--message", message]));
            if *amend {
                args.push("--amend".into());
            }
            if *sign_off {
                args.push("--signoff".into());
            }
            if *gpg_sign {
                args.push("--gpg-sign".into());
            }
        }
        GitOperation::Fetch { remote, prune } => {
            args.extend(strings(&["fetch"]));
            if *prune {
                args.push("--prune".into());
            }
            if let Some(remote) = remote {
                validate_ref_component(remote, "remote")?;
                args.push(remote.clone());
            }
        }
        GitOperation::Pull { rebase } => {
            args.extend(strings(&["pull"]));
            if *rebase {
                args.push("--rebase".into());
            }
        }
        GitOperation::Push {
            remote,
            refspec,
            force_with_lease,
        } => {
            args.extend(strings(&["push"]));
            if *force_with_lease {
                args.push("--force-with-lease".into());
            }
            if let Some(remote) = remote {
                validate_ref_component(remote, "remote")?;
                args.push(remote.clone());
            }
            if let Some(refspec) = refspec {
                validate_revision(refspec, "refspec")?;
                args.push(refspec.clone());
            }
        }
        GitOperation::PushTo {
            remote,
            revision,
            destination,
        } => {
            validate_ref_component(remote, "remote")?;
            validate_revision(revision, "revision")?;
            validate_ref_name(destination, "destination")?;
            args.extend(strings(&[
                "push",
                remote,
                &format!("{revision}:{destination}"),
            ]));
        }
        GitOperation::CreateBranch {
            name,
            start_point,
            checkout,
        } => {
            validate_ref_name(name, "branch")?;
            validate_revision(start_point, "startPoint")?;
            args.extend(if *checkout {
                strings(&["switch", "--create", name, start_point])
            } else {
                strings(&["branch", name, start_point])
            });
        }
        GitOperation::RenameBranch { old_name, new_name } => {
            validate_ref_name(old_name, "oldName")?;
            validate_ref_name(new_name, "newName")?;
            args.extend(strings(&["branch", "--move", old_name, new_name]));
        }
        GitOperation::DeleteBranch { name, force } => {
            validate_ref_name(name, "branch")?;
            args.extend(strings(&[
                "branch",
                if *force { "--delete-force" } else { "--delete" },
                name,
            ]));
        }
        GitOperation::Checkout { target, force } => {
            validate_revision(target, "target")?;
            args.extend(strings(&["checkout"]));
            if *force {
                args.push("--force".into());
            }
            args.push(target.clone());
        }
        GitOperation::CreateTag {
            name,
            revision,
            message,
        } => {
            validate_ref_name(name, "tag")?;
            validate_revision(revision, "revision")?;
            args.extend(strings(&["tag"]));
            if let Some(message) = message {
                validate_text(message, "message")?;
                args.extend(strings(&["--annotate", "--message", message]));
            }
            args.extend([name.clone(), revision.clone()]);
        }
        GitOperation::DeleteTag { name } => {
            validate_ref_name(name, "tag")?;
            args.extend(strings(&["tag", "--delete", name]));
        }
        GitOperation::Reset { revision, mode } => {
            validate_revision(revision, "revision")?;
            let mode = match mode {
                ResetMode::Soft => "--soft",
                ResetMode::Mixed => "--mixed",
                ResetMode::Hard => "--hard",
            };
            args.extend(strings(&["reset", mode, revision]));
        }
        GitOperation::Revert {
            revisions,
            no_commit,
        } => {
            validate_revisions(revisions)?;
            args.extend(strings(&["revert"]));
            if *no_commit {
                args.push("--no-commit".into());
            }
            args.extend(revisions.clone());
        }
        GitOperation::CherryPick {
            revisions,
            no_commit,
        } => {
            validate_revisions(revisions)?;
            args.extend(strings(&["cherry-pick"]));
            if *no_commit {
                args.push("--no-commit".into());
            }
            args.extend(revisions.clone());
        }
        GitOperation::Merge {
            revision,
            no_ff,
            squash,
        } => {
            validate_revision(revision, "revision")?;
            args.extend(strings(&["merge"]));
            if *no_ff {
                args.push("--no-ff".into());
            }
            if *squash {
                args.push("--squash".into());
            }
            args.push(revision.clone());
        }
        GitOperation::Rebase { onto, branch } => {
            validate_revision(onto, "onto")?;
            args.extend(strings(&["rebase", onto]));
            if let Some(branch) = branch {
                validate_revision(branch, "branch")?;
                args.push(branch.clone());
            }
        }
        GitOperation::DropCommits { revisions } => {
            validate_revisions(revisions)?;
            let oldest = revisions.last().expect("validated revisions");
            args.extend(strings(&[
                "rebase",
                "--interactive",
                "--rebase-merges",
                "--autostash",
                &format!("{oldest}^"),
            ]));
            return sequence_editor_command(args, "drop", revisions);
        }
        GitOperation::SquashCommits { revisions } => {
            validate_revisions(revisions)?;
            if revisions.len() < 2 {
                return Err(invalid("revisions", "squash requires at least two commits"));
            }
            let oldest = revisions.last().expect("validated revisions");
            args.extend(strings(&[
                "rebase",
                "--interactive",
                "--rebase-merges",
                "--autostash",
                &format!("{oldest}^"),
            ]));
            return sequence_editor_command(args, "squash", revisions);
        }
        GitOperation::Continue { operation } => args.extend(match operation {
            ContinuableOperation::Merge => strings(&["merge", "--continue"]),
            ContinuableOperation::Rebase => strings(&["rebase", "--continue"]),
            ContinuableOperation::CherryPick => strings(&["cherry-pick", "--continue"]),
            ContinuableOperation::Revert => strings(&["revert", "--continue"]),
        }),
        GitOperation::Skip { operation } => args.extend(match operation {
            SkippableOperation::Rebase => strings(&["rebase", "--skip"]),
            SkippableOperation::CherryPick => strings(&["cherry-pick", "--skip"]),
        }),
        GitOperation::Abort { operation } => args.extend(match operation {
            AbortableOperation::Merge => strings(&["merge", "--abort"]),
            AbortableOperation::Rebase => strings(&["rebase", "--abort"]),
            AbortableOperation::CherryPick => strings(&["cherry-pick", "--abort"]),
            AbortableOperation::Revert => strings(&["revert", "--abort"]),
        }),
        GitOperation::StashPush {
            message,
            include_untracked,
            keep_index,
        } => {
            args.extend(strings(&["stash", "push"]));
            if *include_untracked {
                args.push("--include-untracked".into());
            }
            if *keep_index {
                args.push("--keep-index".into());
            }
            if let Some(message) = message {
                validate_text(message, "message")?;
                args.extend(strings(&["--message", message]));
            }
        }
        GitOperation::StashApply {
            stash,
            pop,
            reinstate_index,
        } => {
            validate_revision(stash, "stash")?;
            args.extend(strings(&["stash", if *pop { "pop" } else { "apply" }]));
            if *reinstate_index {
                args.push("--index".into());
            }
            args.push(stash.clone());
        }
        GitOperation::StashDrop { stash } => {
            validate_revision(stash, "stash")?;
            args.extend(strings(&["stash", "drop", stash]));
        }
        GitOperation::WorktreeAdd {
            path,
            branch,
            start_point,
        } => {
            validate_worktree_path(path)?;
            args.extend(strings(&["worktree", "add"]));
            if let Some(branch) = branch {
                validate_ref_name(branch, "branch")?;
                args.extend(strings(&["-b", branch]));
            }
            args.push(path.clone());
            if let Some(start_point) = start_point {
                validate_revision(start_point, "startPoint")?;
                args.push(start_point.clone());
            }
        }
        GitOperation::WorktreeRemove { path, force } => {
            validate_worktree_path(path)?;
            args.extend(strings(&["worktree", "remove"]));
            if *force {
                args.push("--force".into());
            }
            args.push(path.clone());
        }
        GitOperation::RemoteAdd { name, url } => {
            validate_ref_component(name, "remote")?;
            validate_url(url)?;
            args.extend(strings(&["remote", "add", name, url]));
        }
        GitOperation::RemoteRemove { name } => {
            validate_ref_component(name, "remote")?;
            args.extend(strings(&["remote", "remove", name]));
        }
        GitOperation::RemoteSetUrl { name, url } => {
            validate_ref_component(name, "remote")?;
            validate_url(url)?;
            args.extend(strings(&["remote", "set-url", name, url]));
        }
    }
    Ok(CommandSpec::mutation(args))
}

pub(crate) async fn execute_operation_direct(
    repository: &Path,
    operation: &GitOperation,
) -> AppResult<()> {
    let specification = command_for_operation(operation)?;
    if !specification.mutation {
        return Err(AppError::CommandFailed(
            "multi-root execution requires a mutation operation".into(),
        ));
    }
    let mut command = Command::new("git");
    command
        .args(&specification.args)
        .envs(specification.env)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(if specification.stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = command.spawn()?;
    if let Some(input) = specification.stdin
        && let Some(mut stdin) = child.stdin.take()
    {
        stdin.write_all(&input).await?;
    }
    let output = tokio::time::timeout(specification.timeout, child.wait_with_output())
        .await
        .map_err(|_| AppError::CommandFailed("Git operation timed out".into()))??;
    if output.status.success() {
        Ok(())
    } else {
        Err(AppError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

fn sequence_editor_command(
    args: Vec<String>,
    action: &str,
    revisions: &[String],
) -> AppResult<CommandSpec> {
    let executable = std::env::current_exe()?;
    let quoted_executable = format!("'{}'", executable.to_string_lossy().replace('\'', "'\\''"));
    Ok(CommandSpec::mutation(args)
        .with_env(
            "GIT_SEQUENCE_EDITOR",
            format!("{quoted_executable} --sequence-editor"),
        )
        .with_env("GIT_EDITOR", "true")
        .with_env("GIT_CLIENT_REBASE_ACTION", action)
        .with_env("GIT_CLIENT_REBASE_OIDS", revisions.join(",")))
}

fn strings(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

fn append_paths(args: &mut Vec<String>, paths: &[String]) -> AppResult<()> {
    if !paths.is_empty() {
        args.push("--".into());
        for path in paths {
            validate_relative_path(path)?;
            args.push(path.clone());
        }
    }
    Ok(())
}

fn append_nonempty_paths(args: &mut Vec<String>, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Err(invalid("paths", "must contain at least one path"));
    }
    append_paths(args, paths)
}

fn validate_revisions(revisions: &[String]) -> AppResult<()> {
    if revisions.is_empty() {
        return Err(invalid("revisions", "must contain at least one revision"));
    }
    for revision in revisions {
        validate_revision(revision, "revision")?;
    }
    Ok(())
}

pub(crate) fn validate_relative_path(value: &str) -> AppResult<()> {
    validate_text(value, "path")?;
    let path = Path::new(value);
    if value.is_empty()
        || path.is_absolute()
        || path.components().any(|part| {
            matches!(
                part,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(invalid("path", "must stay inside the repository"));
    }
    Ok(())
}

fn validate_worktree_path(value: &str) -> AppResult<()> {
    validate_text(value, "worktreePath")?;
    if !Path::new(value).is_absolute() {
        return Err(invalid(
            "worktreePath",
            "must be an absolute path selected by the user",
        ));
    }
    Ok(())
}

pub(crate) fn validate_revision(value: &str, field: &'static str) -> AppResult<()> {
    validate_text(value, field)?;
    if value.is_empty() || value.starts_with('-') {
        return Err(invalid(field, "must be a non-option Git revision"));
    }
    Ok(())
}

pub(crate) fn validate_ref_name(value: &str, field: &'static str) -> AppResult<()> {
    validate_text(value, field)?;
    let invalid_shape = value.is_empty()
        || value.starts_with(['-', '.', '/'])
        || value.ends_with(['.', '/'])
        || value.ends_with(".lock")
        || value.contains("..")
        || value.contains("@{")
        || value.contains("//")
        || value
            .chars()
            .any(|character| " ~^:?*[\\".contains(character));
    if invalid_shape {
        return Err(invalid(field, "is not a safe Git ref name"));
    }
    Ok(())
}

fn validate_ref_component(value: &str, field: &'static str) -> AppResult<()> {
    validate_ref_name(value, field)?;
    if value.contains('/') {
        return Err(invalid(field, "must be a single ref component"));
    }
    Ok(())
}

fn validate_url(value: &str) -> AppResult<()> {
    validate_text(value, "url")?;
    if value.is_empty() || value.starts_with('-') {
        return Err(invalid("url", "must not be an option"));
    }
    Ok(())
}

fn validate_text(value: &str, field: &'static str) -> AppResult<()> {
    if value.contains('\0') {
        return Err(invalid(field, "must not contain NUL"));
    }
    Ok(())
}

fn invalid(field: &'static str, reason: impl Into<String>) -> AppError {
    AppError::InvalidInput {
        field,
        reason: reason.into(),
    }
}

fn display_command(args: &[String]) -> String {
    let rendered = args
        .iter()
        .map(|arg| {
            let redacted = redact_credentials(arg);
            if redacted.chars().all(|character| {
                character.is_ascii_alphanumeric() || "-._/:=@{}".contains(character)
            }) {
                redacted
            } else {
                format!("'{0}'", redacted.replace('\'', "'\\''"))
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    format!("git {rendered}")
}

fn redact_credentials(value: &str) -> String {
    let Some(scheme_end) = value.find("://") else {
        return value.to_owned();
    };
    let authority_start = scheme_end + 3;
    let authority_end = value[authority_start..]
        .find('/')
        .map(|offset| authority_start + offset)
        .unwrap_or(value.len());
    let authority = &value[authority_start..authority_end];
    let Some(at) = authority.rfind('@') else {
        return value.to_owned();
    };
    format!(
        "{}***@{}{}",
        &value[..authority_start],
        &authority[at + 1..],
        &value[authority_end..]
    )
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path, sync::mpsc as std_mpsc, time::Duration as StdDuration};

    use tempfile::TempDir;

    use super::*;

    fn repository_id() -> RepositoryId {
        RepositoryId("test".into())
    }

    #[test]
    fn rejects_repository_boundary_escape() {
        let request = GitRequest::Diff {
            repository_id: repository_id(),
            from: None,
            to: None,
            paths: vec!["../secret".into()],
            staged: false,
        };
        assert!(matches!(
            command_for_request(&request),
            Err(AppError::InvalidInput { field: "path", .. })
        ));
    }

    #[test]
    fn rejects_option_injection_for_revisions() {
        let request = GitRequest::CommitDetails {
            repository_id: repository_id(),
            revision: "--output=/tmp/x".into(),
        };
        assert!(command_for_request(&request).is_err());
    }

    #[test]
    fn only_builds_allowlisted_commands() {
        let request = GitRequest::Status {
            repository_id: repository_id(),
        };
        let command = command_for_request(&request).expect("status command");
        assert_eq!(command.args.first().map(String::as_str), Some("status"));
        assert!(!command.mutation);
    }

    #[test]
    fn disables_optional_git_locks_only_for_queries() {
        let query = command_for_request(&GitRequest::Status {
            repository_id: repository_id(),
        })
        .expect("status command");
        assert!(
            query
                .env
                .contains(&("GIT_OPTIONAL_LOCKS".into(), "0".into()))
        );

        let mutation = command_for_operation(&GitOperation::Stage {
            paths: vec!["file.txt".into()],
        })
        .expect("stage command");
        assert!(
            !mutation
                .env
                .iter()
                .any(|(key, _)| key == "GIT_OPTIONAL_LOCKS")
        );
    }

    #[test]
    fn classifies_repository_changes_without_refreshing_unrelated_data() {
        let root = Path::new("/repo");
        let git_directory = root.join(".git");

        assert_eq!(
            classify_repository_path(
                root,
                &git_directory,
                &git_directory,
                &root.join("src/lib.rs")
            ),
            vec![RepositoryInvalidation::Status]
        );
        assert_eq!(
            classify_repository_path(
                root,
                &git_directory,
                &git_directory,
                &git_directory.join("index")
            ),
            vec![RepositoryInvalidation::Status]
        );
        assert!(
            classify_repository_path(
                root,
                &git_directory,
                &git_directory,
                &git_directory.join("index.lock"),
            )
            .is_empty()
        );
        assert!(
            classify_repository_path(
                root,
                &git_directory,
                &git_directory,
                &git_directory.join("objects/ab/cdef"),
            )
            .is_empty()
        );
    }

    #[test]
    fn classifies_git_metadata_by_visible_repository_effect() {
        let root = Path::new("/repo/worktree");
        let git_directory = Path::new("/repo/common/worktrees/feature");
        let common_directory = Path::new("/repo/common");
        let classify = |path: &str| {
            classify_repository_path(root, git_directory, common_directory, Path::new(path))
        };

        assert_eq!(
            classify("/repo/common/worktrees/feature/HEAD"),
            vec![
                RepositoryInvalidation::Status,
                RepositoryInvalidation::History,
            ]
        );
        assert_eq!(
            classify("/repo/common/refs/heads/main"),
            vec![RepositoryInvalidation::History]
        );
        assert_eq!(
            classify("/repo/common/refs/stash"),
            vec![
                RepositoryInvalidation::Status,
                RepositoryInvalidation::History,
                RepositoryInvalidation::Stash,
            ]
        );
        assert_eq!(
            classify("/repo/common/worktrees/feature/MERGE_HEAD"),
            vec![
                RepositoryInvalidation::Status,
                RepositoryInvalidation::Operation,
            ]
        );
        assert_eq!(
            classify("/repo/common/config"),
            vec![RepositoryInvalidation::Management]
        );
        assert_eq!(
            classify("/repo/common/worktrees/another/HEAD"),
            vec![RepositoryInvalidation::Management]
        );
    }

    #[test]
    fn watcher_emits_one_status_refresh_without_reacting_to_git_queries() {
        let fixture = TempDir::new().expect("fixture");
        let repository = fixture.path().canonicalize().expect("canonical repository");
        let init = std::process::Command::new("git")
            .args(["init", "--initial-branch=main"])
            .current_dir(&repository)
            .output()
            .expect("initialize repository");
        assert!(init.status.success());
        let record = RepositoryRecord {
            path: repository.clone(),
            git_directory: repository.join(".git"),
            common_directory: repository.join(".git"),
            operation_lock: Arc::new(AsyncMutex::new(())),
        };
        let (sender, receiver) = std_mpsc::channel();
        let _watcher = create_repository_watcher(&record, move |invalidations| {
            sender.send(invalidations).expect("send invalidations");
        })
        .expect("create watcher");

        std::thread::sleep(StdDuration::from_millis(100));
        fs::write(repository.join("run.sh"), "echo changed\n").expect("write worktree file");
        assert_eq!(
            receiver
                .recv_timeout(StdDuration::from_secs(3))
                .expect("status invalidation"),
            vec![RepositoryInvalidation::Status]
        );
        assert!(receiver.try_recv().is_err());

        let status = std::process::Command::new("git")
            .args(["status", "--porcelain=v2", "-z"])
            .current_dir(&repository)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .output()
            .expect("query status");
        assert!(status.status.success());
        assert!(
            receiver
                .recv_timeout(StdDuration::from_millis(600))
                .is_err()
        );
    }

    #[test]
    fn redacts_http_credentials() {
        assert_eq!(
            redact_credentials("https://alice:token@example.com/acme/repo.git"),
            "https://***@example.com/acme/repo.git"
        );
    }

    #[test]
    fn safely_replaces_non_utf8_output() {
        let bytes = [b'o', b'k', 0xff];
        assert_eq!(String::from_utf8_lossy(&bytes), "ok�");
    }

    #[test]
    fn parses_vendor_suffixed_git_version_parts() {
        assert_eq!(numeric_prefix("55.0"), 55);
        assert_eq!(numeric_prefix("3.windows.1"), 3);
    }

    async fn run_git(repo: &Path, args: &[&str]) -> std::process::Output {
        Command::new("git")
            .args(args)
            .current_dir(repo)
            .env("GIT_TERMINAL_PROMPT", "0")
            .output()
            .await
            .expect("run Git")
    }

    async fn run_operation(repo: &Path, operation: GitOperation) -> std::process::Output {
        let spec = command_for_operation(&operation).expect("build allowlisted operation");
        let mut command = Command::new("git");
        command
            .args(spec.args)
            .current_dir(repo)
            .envs(spec.env)
            .stdin(if spec.stdin.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command.spawn().expect("spawn operation");
        if let Some(input) = spec.stdin
            && let Some(mut stdin) = child.stdin.take()
        {
            stdin
                .write_all(&input)
                .await
                .expect("write operation input");
        }
        child.wait_with_output().await.expect("operation output")
    }

    async fn run_request(repo: &Path, request: GitRequest) -> std::process::Output {
        let spec = command_for_request(&request).expect("build allowlisted request");
        assert!(!spec.mutation);
        Command::new("git")
            .args(spec.args)
            .current_dir(repo)
            .envs(spec.env)
            .stdin(Stdio::null())
            .output()
            .await
            .expect("run request")
    }

    fn assert_success(output: &std::process::Output) {
        assert!(
            output.status.success(),
            "Git failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[tokio::test]
    async fn partially_stages_only_the_selected_line() {
        let fixture = TempDir::new().expect("fixture");
        let repo = fixture.path();
        assert_success(&run_git(repo, &["init", "--initial-branch=main"]).await);
        assert_success(&run_git(repo, &["config", "user.name", "Git Client Test"]).await);
        assert_success(&run_git(repo, &["config", "user.email", "git-client@example.com"]).await);
        fs::write(repo.join("a.txt"), "one\ntwo\nthree\n").expect("write initial file");
        assert_success(&run_git(repo, &["add", "a.txt"]).await);
        assert_success(&run_git(repo, &["commit", "-m", "initial"]).await);
        fs::write(repo.join("a.txt"), "one\nTWO\nextra\nthree\n").expect("modify file");

        let patch = concat!(
            "diff --git a/a.txt b/a.txt\n",
            "--- a/a.txt\n",
            "+++ b/a.txt\n",
            "@@ -2,0 +3,1 @@\n",
            "+extra\n"
        );
        assert_success(
            &run_operation(
                repo,
                GitOperation::PartialPatch {
                    patch: patch.into(),
                    cached: true,
                    reverse: false,
                },
            )
            .await,
        );

        let staged = run_git(repo, &["show", ":a.txt"]).await;
        assert_success(&staged);
        assert_eq!(
            String::from_utf8_lossy(&staged.stdout),
            "one\ntwo\nextra\nthree\n"
        );
        assert_eq!(
            fs::read_to_string(repo.join("a.txt")).expect("read worktree"),
            "one\nTWO\nextra\nthree\n"
        );
    }

    #[tokio::test]
    async fn exercises_local_mutation_workflow_with_unicode_and_spaces() {
        let fixture = TempDir::new().expect("fixture");
        let repo = fixture.path().join("repo with spaces");
        fs::create_dir(&repo).expect("create repository directory");
        assert_success(&run_git(&repo, &["init", "--initial-branch=main"]).await);
        assert_success(&run_git(&repo, &["config", "user.name", "Git Client Test"]).await);
        assert_success(&run_git(&repo, &["config", "user.email", "git-client@example.com"]).await);

        let file = "한글 path.txt";
        fs::write(repo.join(file), "first\n").expect("write fixture");
        assert_success(
            &run_operation(
                &repo,
                GitOperation::Stage {
                    paths: vec![file.into()],
                },
            )
            .await,
        );
        assert_success(
            &run_operation(
                &repo,
                GitOperation::Commit {
                    message: "initial".into(),
                    amend: false,
                    sign_off: true,
                    gpg_sign: false,
                },
            )
            .await,
        );
        assert_success(
            &run_operation(
                &repo,
                GitOperation::CreateTag {
                    name: "v0.1.0".into(),
                    revision: "HEAD".into(),
                    message: None,
                },
            )
            .await,
        );
        assert_success(
            &run_operation(
                &repo,
                GitOperation::CreateBranch {
                    name: "feat/test".into(),
                    start_point: "HEAD".into(),
                    checkout: true,
                },
            )
            .await,
        );
        fs::write(repo.join(file), "first\nfeature\n").expect("modify fixture");
        assert_success(
            &run_operation(
                &repo,
                GitOperation::Stage {
                    paths: vec![file.into()],
                },
            )
            .await,
        );
        assert_success(
            &run_operation(
                &repo,
                GitOperation::Commit {
                    message: "feature".into(),
                    amend: false,
                    sign_off: false,
                    gpg_sign: false,
                },
            )
            .await,
        );
        let feature_oid =
            String::from_utf8_lossy(&run_git(&repo, &["rev-parse", "HEAD"]).await.stdout)
                .trim()
                .to_owned();
        assert_success(
            &run_operation(
                &repo,
                GitOperation::Checkout {
                    target: "main".into(),
                    force: false,
                },
            )
            .await,
        );
        assert_success(
            &run_operation(
                &repo,
                GitOperation::CherryPick {
                    revisions: vec![feature_oid],
                    no_commit: false,
                },
            )
            .await,
        );

        fs::write(repo.join(file), "stashed\n").expect("stash fixture");
        assert_success(
            &run_operation(
                &repo,
                GitOperation::StashPush {
                    message: Some("test stash".into()),
                    include_untracked: true,
                    keep_index: false,
                },
            )
            .await,
        );
        let stash_list = run_request(
            &repo,
            GitRequest::StashList {
                repository_id: repository_id(),
            },
        )
        .await;
        assert_success(&stash_list);
        assert!(String::from_utf8_lossy(&stash_list.stdout).contains("test stash"));
        let stash_files = run_request(
            &repo,
            GitRequest::StashShow {
                repository_id: repository_id(),
                stash: "stash@{0}".into(),
                mode: StashShowMode::Files,
            },
        )
        .await;
        assert_success(&stash_files);
        assert!(
            stash_files
                .stdout
                .windows(file.len())
                .any(|value| value == file.as_bytes())
        );
        let stash_patch = run_request(
            &repo,
            GitRequest::StashShow {
                repository_id: repository_id(),
                stash: "stash@{0}".into(),
                mode: StashShowMode::Patch,
            },
        )
        .await;
        assert_success(&stash_patch);
        assert!(String::from_utf8_lossy(&stash_patch.stdout).contains("+stashed"));
        assert_success(
            &run_operation(
                &repo,
                GitOperation::StashApply {
                    stash: "stash@{0}".into(),
                    pop: true,
                    reinstate_index: false,
                },
            )
            .await,
        );

        let worktree = fixture.path().join("linked worktree");
        assert_success(
            &run_operation(
                &repo,
                GitOperation::WorktreeAdd {
                    path: worktree.to_string_lossy().into_owned(),
                    branch: Some("worktree-test".into()),
                    start_point: Some("HEAD".into()),
                },
            )
            .await,
        );
        assert!(worktree.join(".git").exists());
        assert_success(
            &run_operation(
                &repo,
                GitOperation::WorktreeRemove {
                    path: worktree.to_string_lossy().into_owned(),
                    force: true,
                },
            )
            .await,
        );

        let (snapshot, canonical_repo) =
            inspect_repository(&repo).await.expect("inspect repository");
        assert_eq!(snapshot.current_branch.as_deref(), Some("main"));
        assert!(!snapshot.is_bare);
        assert_eq!(
            canonical_repo,
            repo.canonicalize().expect("canonical fixture")
        );
    }
}
