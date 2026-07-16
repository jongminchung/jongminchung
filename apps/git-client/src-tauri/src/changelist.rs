use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Stdio,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tokio::process::Command;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    git::{AppState, repository_record, validate_relative_path},
    model::{
        Changelist, ChangelistCommitOptions, ChangelistCommitResult, GitOperation, RepositoryId,
    },
};

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChangelistManifest {
    changelists: Vec<Changelist>,
}

struct IndexBackup {
    path: PathBuf,
    bytes: Option<Vec<u8>>,
}

#[tauri::command]
pub fn list_changelists(
    repository_id: RepositoryId,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<Changelist>> {
    repository_record(&state, &repository_id)?;
    let mut changelists = read_manifest(&app, &repository_id)?.changelists;
    changelists.sort_by_key(|changelist| changelist.created_at_ms);
    Ok(changelists)
}

#[tauri::command]
pub fn save_changelist(
    repository_id: RepositoryId,
    id: Option<String>,
    name: String,
    paths: Vec<String>,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Changelist> {
    repository_record(&state, &repository_id)?;
    let name = name.trim();
    if name.is_empty() || name.contains('\0') {
        return Err(invalid(
            "name",
            "must be non-empty and must not contain NUL",
        ));
    }
    let mut unique_paths = paths;
    unique_paths.sort();
    unique_paths.dedup();
    for path in &unique_paths {
        validate_relative_path(path)?;
    }

    let mut manifest = read_manifest(&app, &repository_id)?;
    let now = now_ms();
    let changelist = if let Some(id) = id {
        validate_uuid(&id, "changelistId")?;
        let existing = manifest
            .changelists
            .iter_mut()
            .find(|changelist| changelist.id == id)
            .ok_or_else(|| invalid("changelistId", "changelist does not exist"))?;
        existing.name = name.to_owned();
        existing.paths = unique_paths;
        existing.updated_at_ms = now;
        existing.clone()
    } else {
        let changelist = Changelist {
            id: Uuid::new_v4().to_string(),
            repository_id: repository_id.clone(),
            name: name.to_owned(),
            paths: unique_paths,
            created_at_ms: now,
            updated_at_ms: now,
        };
        manifest.changelists.push(changelist.clone());
        changelist
    };
    write_manifest(&app, &repository_id, &manifest)?;
    Ok(changelist)
}

#[tauri::command]
pub fn delete_changelist(
    repository_id: RepositoryId,
    changelist_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    repository_record(&state, &repository_id)?;
    validate_uuid(&changelist_id, "changelistId")?;
    let mut manifest = read_manifest(&app, &repository_id)?;
    manifest
        .changelists
        .retain(|changelist| changelist.id != changelist_id);
    write_manifest(&app, &repository_id, &manifest)
}

#[tauri::command]
pub async fn commit_changelist(
    repository_id: RepositoryId,
    changelist_id: String,
    options: ChangelistCommitOptions,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<ChangelistCommitResult> {
    validate_uuid(&changelist_id, "changelistId")?;
    if options.message.trim().is_empty() || options.message.contains('\0') {
        return Err(invalid(
            "message",
            "must be non-empty and must not contain NUL",
        ));
    }
    let record = repository_record(&state, &repository_id)?;
    let _guard = record.operation_lock.lock().await;
    let mut manifest = read_manifest(&app, &repository_id)?;
    let changelist = manifest
        .changelists
        .iter()
        .find(|changelist| changelist.id == changelist_id)
        .cloned()
        .ok_or_else(|| invalid("changelistId", "changelist does not exist"))?;
    if changelist.paths.is_empty() {
        return Err(invalid("changelistId", "changelist has no files"));
    }
    crate::recovery::record_before_operation(
        &app,
        &repository_id,
        &record.path,
        &GitOperation::Commit {
            message: options.message.clone(),
            amend: options.amend,
            sign_off: options.sign_off,
            gpg_sign: options.gpg_sign,
        },
    )
    .await?;
    let commit_oid = commit_only(
        &record.path,
        &changelist.paths,
        &options.message,
        options.amend,
        options.sign_off,
        options.gpg_sign,
    )
    .await?;
    manifest.changelists.retain(|item| item.id != changelist_id);
    write_manifest(&app, &repository_id, &manifest)?;
    Ok(ChangelistCommitResult {
        changelist_id,
        commit_oid,
    })
}

async fn commit_only(
    repository: &Path,
    paths: &[String],
    message: &str,
    amend: bool,
    sign_off: bool,
    gpg_sign: bool,
) -> AppResult<String> {
    for path in paths {
        validate_relative_path(path)?;
    }
    let original_head = capture_optional(repository, &["rev-parse", "--verify", "HEAD"])
        .await
        .map(trimmed);
    let original_branch =
        capture_optional(repository, &["symbolic-ref", "--quiet", "--short", "HEAD"])
            .await
            .map(trimmed);
    let backup = backup_index(repository).await?;
    let unselected_index = capture_unselected_index(repository, paths).await?;
    let mut arguments = vec![
        "commit".into(),
        "--only".into(),
        "--message".into(),
        message.to_owned(),
    ];
    if amend {
        arguments.push("--amend".into());
    }
    if sign_off {
        arguments.push("--signoff".into());
    }
    if gpg_sign {
        arguments.push("--gpg-sign".into());
    }
    arguments.push("--".into());
    arguments.extend(paths.iter().cloned());

    if let Err(error) = run_git(repository, &arguments).await {
        restore_index(&backup)?;
        return Err(error);
    }
    let preserved_index = capture_unselected_index(repository, paths).await?;
    if unselected_index != preserved_index {
        rollback_commit(
            repository,
            original_head.as_deref(),
            original_branch.as_deref(),
        )
        .await?;
        restore_index(&backup)?;
        return Err(AppError::CommandFailed(
            "selected changelist commit changed unrelated index entries; the commit was rolled back"
                .into(),
        ));
    }
    capture_required(repository, &["rev-parse", "HEAD"])
        .await
        .map(trimmed)
}

async fn backup_index(repository: &Path) -> AppResult<IndexBackup> {
    let raw_path = capture_required(repository, &["rev-parse", "--git-path", "index"]).await?;
    let path = PathBuf::from(raw_path.trim());
    let path = if path.is_absolute() {
        path
    } else {
        repository.join(path)
    };
    let bytes = match fs::read(&path) {
        Ok(bytes) => Some(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.into()),
    };
    Ok(IndexBackup { path, bytes })
}

fn restore_index(backup: &IndexBackup) -> AppResult<()> {
    match &backup.bytes {
        Some(bytes) => {
            let mut file = fs::File::create(&backup.path)?;
            file.write_all(bytes)?;
            file.sync_all()?;
        }
        None if backup.path.exists() => fs::remove_file(&backup.path)?,
        None => {}
    }
    Ok(())
}

async fn capture_unselected_index(
    repository: &Path,
    excluded_paths: &[String],
) -> AppResult<BTreeMap<Vec<u8>, Vec<u8>>> {
    let output = run_git_capture(
        repository,
        &["ls-files".into(), "--stage".into(), "-z".into()],
    )
    .await?;
    let excluded = excluded_paths
        .iter()
        .map(String::as_bytes)
        .collect::<Vec<_>>();
    let mut entries = BTreeMap::new();
    for record in output
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let Some(separator) = record.iter().position(|byte| *byte == b'\t') else {
            continue;
        };
        let path = &record[separator + 1..];
        if excluded.contains(&path) {
            continue;
        }
        entries.insert(path.to_vec(), record[..separator].to_vec());
    }
    Ok(entries)
}

async fn rollback_commit(
    repository: &Path,
    original_head: Option<&str>,
    original_branch: Option<&str>,
) -> AppResult<()> {
    if let Some(original_head) = original_head {
        run_git(
            repository,
            &["reset".into(), "--soft".into(), original_head.into()],
        )
        .await
    } else if let Some(branch) = original_branch {
        run_git(
            repository,
            &[
                "update-ref".into(),
                "--delete".into(),
                format!("refs/heads/{branch}"),
            ],
        )
        .await
    } else {
        Err(AppError::CommandFailed(
            "cannot roll back an initial detached commit".into(),
        ))
    }
}

async fn capture_required(repository: &Path, args: &[&str]) -> AppResult<String> {
    let output = git_command(repository, args).output().await?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(AppError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

async fn capture_optional(repository: &Path, args: &[&str]) -> Option<String> {
    let output = git_command(repository, args).output().await.ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

async fn run_git(repository: &Path, args: &[String]) -> AppResult<()> {
    let output = git_command_owned(repository, args).output().await?;
    if output.status.success() {
        Ok(())
    } else {
        Err(AppError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

async fn run_git_capture(repository: &Path, args: &[String]) -> AppResult<Vec<u8>> {
    let output = git_command_owned(repository, args)
        .env("GIT_OPTIONAL_LOCKS", "0")
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

fn git_command(repository: &Path, args: &[&str]) -> Command {
    let mut command = Command::new("git");
    command
        .args(args)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command
}

fn git_command_owned(repository: &Path, args: &[String]) -> Command {
    let mut command = Command::new("git");
    command
        .args(args)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command
}

fn read_manifest(
    app: &tauri::AppHandle,
    repository_id: &RepositoryId,
) -> AppResult<ChangelistManifest> {
    let path = manifest_path(app, repository_id)?;
    if !path.exists() {
        return Ok(ChangelistManifest::default());
    }
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}

fn write_manifest(
    app: &tauri::AppHandle,
    repository_id: &RepositoryId,
    manifest: &ChangelistManifest,
) -> AppResult<()> {
    let path = manifest_path(app, repository_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension("tmp");
    let mut file = fs::File::create(&temporary)?;
    file.write_all(&serde_json::to_vec_pretty(manifest)?)?;
    file.sync_all()?;
    fs::rename(temporary, path)?;
    Ok(())
}

fn manifest_path(app: &tauri::AppHandle, repository_id: &RepositoryId) -> AppResult<PathBuf> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Io(std::io::Error::other(error)))?
        .join("changelists")
        .join(format!("{}.json", repository_id.0)))
}

fn validate_uuid(value: &str, field: &'static str) -> AppResult<()> {
    Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| invalid(field, "must be a UUID"))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn trimmed(value: String) -> String {
    value.trim().to_owned()
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

    async fn git(repository: &Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .args(args)
            .current_dir(repository)
            .output()
            .await
            .expect("run Git");
        assert!(
            output.status.success(),
            "Git failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_owned()
    }

    #[tokio::test]
    async fn commits_selected_files_without_changing_unrelated_index_entries() {
        let directory = TempDir::new().expect("tempdir");
        git(directory.path(), &["init", "--initial-branch=main"]).await;
        git(directory.path(), &["config", "user.name", "Test"]).await;
        git(
            directory.path(),
            &["config", "user.email", "test@example.com"],
        )
        .await;
        fs::write(directory.path().join("staged.txt"), "base\n").expect("staged base");
        fs::write(directory.path().join("selected.txt"), "base\n").expect("selected base");
        git(directory.path(), &["add", "."]).await;
        git(directory.path(), &["commit", "-m", "base"]).await;

        fs::write(directory.path().join("staged.txt"), "staged\n").expect("staged change");
        fs::write(directory.path().join("selected.txt"), "selected\n").expect("selected change");
        git(directory.path(), &["add", "staged.txt"]).await;
        let before = git(directory.path(), &["ls-files", "--stage", "staged.txt"]).await;

        commit_only(
            directory.path(),
            &["selected.txt".into()],
            "selected",
            false,
            false,
            false,
        )
        .await
        .expect("commit changelist");

        let after = git(directory.path(), &["ls-files", "--stage", "staged.txt"]).await;
        assert_eq!(before, after);
        assert_eq!(
            git(directory.path(), &["show", "HEAD:selected.txt"]).await,
            "selected"
        );
        assert_eq!(
            git(directory.path(), &["diff", "--cached", "--name-only"]).await,
            "staged.txt"
        );
    }
}
