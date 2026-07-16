use std::{
    collections::BTreeSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Stdio,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;
use tokio::{io::AsyncWriteExt, process::Command};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    git::{AppState, repository_record},
    model::{RepositoryId, ShelfEntry, ShelfFile},
};

const MANIFEST_FILE: &str = "manifest.json";
const INDEX_PATCH_FILE: &str = "index.patch";
const WORKTREE_PATCH_FILE: &str = "worktree.patch";

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShelfManifest {
    entry: ShelfEntry,
}

#[tauri::command]
pub async fn create_shelf(
    repository_id: RepositoryId,
    message: String,
    paths: Vec<String>,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<ShelfEntry> {
    if paths.is_empty() {
        return Err(invalid("paths", "must contain at least one path"));
    }
    for path in &paths {
        super::git::validate_relative_path(path)?;
    }
    if message.contains('\0') {
        return Err(invalid("message", "must not contain NUL"));
    }
    let record = repository_record(&state, &repository_id)?;
    let _guard = record.operation_lock.lock().await;
    let shelf_id = Uuid::new_v4().to_string();
    let shelves = shelves_directory(&app, &repository_id)?;
    fs::create_dir_all(&shelves)?;
    let temporary = shelves.join(format!(".{shelf_id}.tmp"));
    let destination = shelves.join(&shelf_id);
    fs::create_dir(&temporary)?;

    let result = create_backup(
        &record.path,
        &temporary,
        &repository_id,
        &shelf_id,
        message,
        &paths,
    )
    .await;
    let entry = match result {
        Ok(entry) => entry,
        Err(error) => {
            let _ = fs::remove_dir_all(&temporary);
            return Err(error);
        }
    };
    fs::rename(&temporary, &destination)?;
    verify_shelf_directory(&destination)?;
    remove_shelved_changes(&record.path, &entry.files).await?;
    Ok(entry)
}

#[tauri::command]
pub fn list_shelves(
    repository_id: RepositoryId,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<ShelfEntry>> {
    repository_record(&state, &repository_id)?;
    let shelves = shelves_directory(&app, &repository_id)?;
    if !shelves.exists() {
        return Ok(Vec::new());
    }
    let mut entries = fs::read_dir(shelves)?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter_map(|entry| {
            read_manifest(&entry.path())
                .ok()
                .map(|manifest| manifest.entry)
        })
        .collect::<Vec<_>>();
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.created_at_ms));
    Ok(entries)
}

#[tauri::command]
pub async fn apply_shelf(
    repository_id: RepositoryId,
    shelf_id: String,
    drop_after_apply: bool,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    validate_shelf_id(&shelf_id)?;
    let record = repository_record(&state, &repository_id)?;
    let _guard = record.operation_lock.lock().await;
    let directory = shelves_directory(&app, &repository_id)?.join(&shelf_id);
    let manifest = verify_shelf_directory(&directory)?;
    for file in manifest.entry.files.iter().filter(|file| file.untracked) {
        if record.path.join(&file.path).exists() {
            return Err(invalid("shelf", format!("{} already exists", file.path)));
        }
    }
    apply_patch_file(&record.path, &directory.join(INDEX_PATCH_FILE), true).await?;
    apply_patch_file(&record.path, &directory.join(WORKTREE_PATCH_FILE), false).await?;
    for file in manifest.entry.files.iter().filter(|file| file.untracked) {
        let source = directory.join("untracked").join(&file.path);
        let destination = record.path.join(&file.path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(source, destination)?;
    }
    if drop_after_apply {
        fs::remove_dir_all(directory)?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_shelf(
    repository_id: RepositoryId,
    shelf_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    repository_record(&state, &repository_id)?;
    validate_shelf_id(&shelf_id)?;
    let directory = shelves_directory(&app, &repository_id)?.join(shelf_id);
    if directory.exists() {
        verify_shelf_directory(&directory)?;
        fs::remove_dir_all(directory)?;
    }
    Ok(())
}

async fn create_backup(
    repository: &Path,
    directory: &Path,
    repository_id: &RepositoryId,
    shelf_id: &str,
    message: String,
    requested_paths: &[String],
) -> AppResult<ShelfEntry> {
    let index_patch = capture_git(repository, patch_arguments(true, requested_paths)).await?;
    let worktree_patch = capture_git(repository, patch_arguments(false, requested_paths)).await?;
    let untracked = capture_git(
        repository,
        path_arguments(
            &["ls-files", "--others", "--exclude-standard", "-z"],
            requested_paths,
        ),
    )
    .await?;
    let untracked = String::from_utf8_lossy(&untracked)
        .split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_owned)
        .collect::<BTreeSet<_>>();
    write_synced(&directory.join(INDEX_PATCH_FILE), &index_patch)?;
    write_synced(&directory.join(WORKTREE_PATCH_FILE), &worktree_patch)?;

    let mut files = BTreeSet::new();
    files.extend(requested_paths.iter().cloned());
    files.extend(untracked.iter().cloned());
    let mut shelf_files = Vec::new();
    for path in files {
        super::git::validate_relative_path(&path)?;
        let is_untracked = untracked.contains(&path);
        let checksum = if is_untracked {
            let source = repository.join(&path);
            let bytes = fs::read(&source)?;
            let destination = directory.join("untracked").join(&path);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)?;
            }
            write_synced(&destination, &bytes)?;
            checksum(&bytes)
        } else {
            String::new()
        };
        shelf_files.push(ShelfFile {
            path,
            checksum,
            untracked: is_untracked,
        });
    }
    let entry = ShelfEntry {
        id: shelf_id.to_owned(),
        repository_id: repository_id.clone(),
        message: if message.trim().is_empty() {
            "Shelved changes".into()
        } else {
            message
        },
        created_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        files: shelf_files,
        index_patch_checksum: checksum(&index_patch),
        worktree_patch_checksum: checksum(&worktree_patch),
    };
    let manifest = serde_json::to_vec_pretty(&ShelfManifest {
        entry: entry.clone(),
    })?;
    write_synced(&directory.join(MANIFEST_FILE), &manifest)?;
    verify_shelf_directory(directory)?;
    Ok(entry)
}

async fn remove_shelved_changes(repository: &Path, files: &[ShelfFile]) -> AppResult<()> {
    let tracked = files
        .iter()
        .filter(|file| !file.untracked)
        .map(|file| file.path.clone())
        .collect::<Vec<_>>();
    if !tracked.is_empty() {
        run_git(
            repository,
            path_arguments(
                &["restore", "--source=HEAD", "--staged", "--worktree"],
                &tracked,
            ),
            None,
        )
        .await?;
    }
    for file in files.iter().filter(|file| file.untracked) {
        let path = repository.join(&file.path);
        if path.is_file() {
            fs::remove_file(path)?;
        }
    }
    Ok(())
}

async fn apply_patch_file(repository: &Path, path: &Path, cached: bool) -> AppResult<()> {
    let patch = fs::read(path)?;
    if patch.is_empty() {
        return Ok(());
    }
    let mut args = vec!["apply".into(), "--whitespace=nowarn".into()];
    if cached {
        args.push("--3way".into());
        args.push("--index".into());
    }
    args.push("-".into());
    run_git(repository, args, Some(patch)).await
}

fn verify_shelf_directory(directory: &Path) -> AppResult<ShelfManifest> {
    let manifest = read_manifest(directory)?;
    let index_patch = fs::read(directory.join(INDEX_PATCH_FILE))?;
    let worktree_patch = fs::read(directory.join(WORKTREE_PATCH_FILE))?;
    if checksum(&index_patch) != manifest.entry.index_patch_checksum
        || checksum(&worktree_patch) != manifest.entry.worktree_patch_checksum
    {
        return Err(invalid("shelf", "patch checksum mismatch"));
    }
    for file in manifest.entry.files.iter().filter(|file| file.untracked) {
        let bytes = fs::read(directory.join("untracked").join(&file.path))?;
        if checksum(&bytes) != file.checksum {
            return Err(invalid(
                "shelf",
                format!("checksum mismatch for {}", file.path),
            ));
        }
    }
    Ok(manifest)
}

fn read_manifest(directory: &Path) -> AppResult<ShelfManifest> {
    Ok(serde_json::from_slice(&fs::read(
        directory.join(MANIFEST_FILE),
    )?)?)
}

fn patch_arguments(cached: bool, paths: &[String]) -> Vec<String> {
    let mut base = vec![
        "diff".into(),
        "--binary".into(),
        "--full-index".into(),
        "--no-color".into(),
    ];
    if cached {
        base.push("--cached".into());
    }
    append_paths(base, paths)
}

fn path_arguments(base: &[&str], paths: &[String]) -> Vec<String> {
    append_paths(
        base.iter().map(|value| (*value).to_owned()).collect(),
        paths,
    )
}

fn append_paths(mut arguments: Vec<String>, paths: &[String]) -> Vec<String> {
    arguments.push("--".into());
    arguments.extend(paths.iter().cloned());
    arguments
}

async fn capture_git(repository: &Path, arguments: Vec<String>) -> AppResult<Vec<u8>> {
    let output = Command::new("git")
        .args(arguments)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("LC_ALL", "C")
        .output()
        .await?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(AppError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

async fn run_git(
    repository: &Path,
    arguments: Vec<String>,
    stdin: Option<Vec<u8>>,
) -> AppResult<()> {
    let mut command = Command::new("git");
    command
        .args(arguments)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("LC_ALL", "C")
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn()?;
    if let Some(input) = stdin
        && let Some(mut writer) = child.stdin.take()
    {
        writer.write_all(&input).await?;
    }
    let output = child.wait_with_output().await?;
    if output.status.success() {
        Ok(())
    } else {
        Err(AppError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

fn shelves_directory(app: &tauri::AppHandle, repository_id: &RepositoryId) -> AppResult<PathBuf> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Io(std::io::Error::other(error)))?
        .join("shelves")
        .join(&repository_id.0))
}

fn write_synced(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let mut file = fs::File::create(path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    Ok(())
}

fn checksum(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn validate_shelf_id(value: &str) -> AppResult<()> {
    Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| invalid("shelfId", "must be a UUID"))
}

fn invalid(field: &'static str, reason: impl Into<String>) -> AppError {
    AppError::InvalidInput {
        field,
        reason: reason.into(),
    }
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    async fn git(repository: &Path, arguments: &[&str]) -> std::process::Output {
        Command::new("git")
            .args(arguments)
            .current_dir(repository)
            .output()
            .await
            .expect("run Git")
    }

    fn success(output: &std::process::Output) {
        assert!(
            output.status.success(),
            "Git failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[tokio::test]
    async fn preserves_index_worktree_and_untracked_layers() {
        let fixture = TempDir::new().expect("fixture");
        let repository = fixture.path().join("repository");
        let shelf = fixture.path().join("shelf");
        fs::create_dir(&repository).expect("repository directory");
        fs::create_dir(&shelf).expect("shelf directory");
        success(&git(&repository, &["init", "--initial-branch=main"]).await);
        success(&git(&repository, &["config", "user.name", "Shelf Test"]).await);
        success(&git(&repository, &["config", "user.email", "shelf@example.com"]).await);
        fs::write(repository.join("tracked.txt"), "base\n").expect("base file");
        success(&git(&repository, &["add", "tracked.txt"]).await);
        success(&git(&repository, &["commit", "-m", "base"]).await);

        fs::write(repository.join("tracked.txt"), "staged\n").expect("staged file");
        success(&git(&repository, &["add", "tracked.txt"]).await);
        fs::write(repository.join("tracked.txt"), "worktree\n").expect("worktree file");
        fs::write(repository.join("새 파일.txt"), "untracked\n").expect("untracked file");
        let entry = create_backup(
            &repository,
            &shelf,
            &RepositoryId("repository".into()),
            "f6478d5c-5aa0-4d4a-b646-cb950b0ca555",
            "layered changes".into(),
            &["tracked.txt".into(), "새 파일.txt".into()],
        )
        .await
        .expect("create shelf backup");
        assert_eq!(entry.files.len(), 2);
        assert!(entry.files.iter().any(|file| file.untracked));
        remove_shelved_changes(&repository, &entry.files)
            .await
            .expect("remove verified changes");
        assert_eq!(
            fs::read_to_string(repository.join("tracked.txt")).expect("clean file"),
            "base\n"
        );
        assert!(!repository.join("새 파일.txt").exists());

        apply_patch_file(&repository, &shelf.join(INDEX_PATCH_FILE), true)
            .await
            .expect("apply index patch");
        apply_patch_file(&repository, &shelf.join(WORKTREE_PATCH_FILE), false)
            .await
            .expect("apply worktree patch");
        for file in entry.files.iter().filter(|file| file.untracked) {
            fs::copy(
                shelf.join("untracked").join(&file.path),
                repository.join(&file.path),
            )
            .expect("restore untracked file");
        }
        assert_eq!(
            String::from_utf8_lossy(&git(&repository, &["show", ":tracked.txt"]).await.stdout),
            "staged\n"
        );
        assert_eq!(
            fs::read_to_string(repository.join("tracked.txt")).expect("restored file"),
            "worktree\n"
        );
        assert_eq!(
            fs::read_to_string(repository.join("새 파일.txt")).expect("restored untracked"),
            "untracked\n"
        );
        verify_shelf_directory(&shelf).expect("verified shelf remains reusable");
    }
}
