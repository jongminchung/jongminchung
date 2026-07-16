use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Stdio,
};

use tokio::process::Command;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    git::{AppState, repository_record, validate_relative_path},
    model::{ConflictContent, ConflictFile, RepositoryId},
};

const MAX_TEXT_BYTES: usize = 5 * 1024 * 1024;
const MAX_TEXT_LINES: usize = 50_000;

#[derive(Default)]
struct ConflictBuilder {
    base_oid: Option<String>,
    local_oid: Option<String>,
    remote_oid: Option<String>,
}

#[tauri::command]
pub async fn list_conflicts(
    repository_id: RepositoryId,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<ConflictFile>> {
    let record = repository_record(&state, &repository_id)?;
    list_conflicts_in(&record.path).await
}

#[tauri::command]
pub async fn read_conflict(
    repository_id: RepositoryId,
    path: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<ConflictContent> {
    let record = repository_record(&state, &repository_id)?;
    read_conflict_in(&record.path, &path).await
}

#[tauri::command]
pub async fn write_conflict_result(
    repository_id: RepositoryId,
    path: String,
    result: String,
    stage: bool,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    let record = repository_record(&state, &repository_id)?;
    let _guard = record.operation_lock.lock().await;
    write_conflict_result_in(&record.path, &path, &result).await?;
    if stage {
        run_git(&record.path, &["add", "--", &path]).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn resolve_binary_conflict(
    repository_id: RepositoryId,
    path: String,
    side: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    validate_relative_path(&path)?;
    let option = match side.as_str() {
        "ours" => "--ours",
        "theirs" => "--theirs",
        _ => {
            return Err(AppError::InvalidInput {
                field: "side",
                reason: "must be ours or theirs".into(),
            });
        }
    };
    let record = repository_record(&state, &repository_id)?;
    let _guard = record.operation_lock.lock().await;
    run_git(&record.path, &["checkout", option, "--", &path]).await?;
    run_git(&record.path, &["add", "--", &path]).await
}

async fn list_conflicts_in(repository: &Path) -> AppResult<Vec<ConflictFile>> {
    let output = git_output(repository, &["ls-files", "--unmerged", "-z"]).await?;
    let mut conflicts = BTreeMap::<String, ConflictBuilder>::new();
    for record in output
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let separator = record
            .iter()
            .position(|byte| *byte == b'\t')
            .ok_or_else(|| AppError::CommandFailed("invalid unmerged index record".into()))?;
        let metadata = std::str::from_utf8(&record[..separator])
            .map_err(|_| AppError::CommandFailed("invalid unmerged index metadata".into()))?;
        let path = std::str::from_utf8(&record[separator + 1..])
            .map_err(|_| {
                AppError::CommandFailed("non-UTF-8 conflict paths are unsupported".into())
            })?
            .to_owned();
        validate_relative_path(&path)?;
        let fields = metadata.split_whitespace().collect::<Vec<_>>();
        let oid = fields
            .get(1)
            .ok_or_else(|| AppError::CommandFailed("missing conflict object ID".into()))?
            .to_string();
        let stage = fields
            .get(2)
            .and_then(|value| value.parse::<u8>().ok())
            .ok_or_else(|| AppError::CommandFailed("missing conflict stage".into()))?;
        let entry = conflicts.entry(path).or_default();
        match stage {
            1 => entry.base_oid = Some(oid),
            2 => entry.local_oid = Some(oid),
            3 => entry.remote_oid = Some(oid),
            _ => return Err(AppError::CommandFailed("invalid conflict stage".into())),
        }
    }

    let mut files = Vec::with_capacity(conflicts.len());
    for (path, conflict) in conflicts {
        let blobs = [
            conflict.base_oid.as_deref(),
            conflict.local_oid.as_deref(),
            conflict.remote_oid.as_deref(),
        ];
        let mut binary = false;
        for oid in blobs.into_iter().flatten() {
            binary |= !is_text_blob(repository, oid).await?;
        }
        files.push(ConflictFile {
            path,
            base_oid: conflict.base_oid,
            local_oid: conflict.local_oid,
            remote_oid: conflict.remote_oid,
            binary,
        });
    }
    Ok(files)
}

async fn read_conflict_in(repository: &Path, path: &str) -> AppResult<ConflictContent> {
    validate_relative_path(path)?;
    let conflicts = list_conflicts_in(repository).await?;
    let conflict = conflicts
        .iter()
        .find(|conflict| conflict.path == path)
        .ok_or_else(|| AppError::InvalidInput {
            field: "path",
            reason: "file is not conflicted".into(),
        })?;
    let base = read_stage(repository, path, 1).await?;
    let local = read_stage(repository, path, 2).await?;
    let remote = read_stage(repository, path, 3).await?;
    let result_path = checked_worktree_path(repository, path)?;
    let result = read_text_file(&result_path)?;
    let binary = conflict.binary
        || [
            base.as_ref(),
            local.as_ref(),
            remote.as_ref(),
            result.as_ref(),
        ]
        .into_iter()
        .any(|content| content.is_none());
    let (local_label, remote_label) = conflict_labels(repository).await?;
    Ok(ConflictContent {
        path: path.to_owned(),
        base,
        local,
        remote,
        result,
        binary,
        local_label,
        remote_label,
    })
}

async fn write_conflict_result_in(repository: &Path, path: &str, result: &str) -> AppResult<()> {
    validate_relative_path(path)?;
    validate_text_content(result)?;
    let destination = checked_worktree_path(repository, path)?;
    let parent = destination
        .parent()
        .ok_or_else(|| AppError::CommandFailed("conflict file has no parent".into()))?;
    let temporary = parent.join(format!(".git-client-conflict-{}.tmp", Uuid::new_v4()));
    let mut file = fs::File::create(&temporary)?;
    file.write_all(result.as_bytes())?;
    file.sync_all()?;
    if let Ok(metadata) = fs::metadata(&destination) {
        fs::set_permissions(&temporary, metadata.permissions())?;
    }
    fs::rename(&temporary, &destination)?;
    Ok(())
}

async fn read_stage(repository: &Path, path: &str, stage: u8) -> AppResult<Option<String>> {
    let revision = format!(":{stage}:{path}");
    let output = Command::new("git")
        .args(["cat-file", "blob", &revision])
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .await?;
    if !output.status.success() {
        return Ok(None);
    }
    Ok(text_from_bytes(&output.stdout))
}

async fn is_text_blob(repository: &Path, oid: &str) -> AppResult<bool> {
    let output = git_output(repository, &["cat-file", "blob", oid]).await?;
    Ok(text_from_bytes(&output).is_some())
}

fn read_text_file(path: &Path) -> AppResult<Option<String>> {
    match fs::read(path) {
        Ok(bytes) => Ok(text_from_bytes(&bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Some(String::new())),
        Err(error) => Err(error.into()),
    }
}

fn text_from_bytes(bytes: &[u8]) -> Option<String> {
    if bytes.len() > MAX_TEXT_BYTES || bytes.contains(&0) {
        return None;
    }
    let value = std::str::from_utf8(bytes).ok()?;
    (value.lines().count() <= MAX_TEXT_LINES).then(|| value.to_owned())
}

fn validate_text_content(value: &str) -> AppResult<()> {
    if value.len() > MAX_TEXT_BYTES
        || value.lines().count() > MAX_TEXT_LINES
        || value.contains('\0')
    {
        return Err(AppError::InvalidInput {
            field: "result",
            reason: "must be UTF-8 text no larger than 5 MiB or 50,000 lines".into(),
        });
    }
    Ok(())
}

fn checked_worktree_path(repository: &Path, path: &str) -> AppResult<PathBuf> {
    let destination = repository.join(path);
    if fs::symlink_metadata(&destination).is_ok_and(|metadata| metadata.file_type().is_symlink()) {
        return Err(AppError::InvalidInput {
            field: "path",
            reason: "symbolic-link conflict results are unsupported".into(),
        });
    }
    let parent = destination
        .parent()
        .ok_or_else(|| AppError::InvalidInput {
            field: "path",
            reason: "must have a parent directory".into(),
        })?
        .canonicalize()?;
    let repository = repository.canonicalize()?;
    if !parent.starts_with(&repository) {
        return Err(AppError::InvalidInput {
            field: "path",
            reason: "escapes the repository boundary".into(),
        });
    }
    Ok(destination)
}

async fn conflict_labels(repository: &Path) -> AppResult<(String, String)> {
    let git_directory =
        String::from_utf8(git_output(repository, &["rev-parse", "--git-dir"]).await?)
            .map_err(|_| AppError::CommandFailed("non-UTF-8 Git directory".into()))?;
    let raw_path = PathBuf::from(git_directory.trim());
    let git_directory = if raw_path.is_absolute() {
        raw_path
    } else {
        repository.join(raw_path)
    };
    if git_directory.join("rebase-merge").exists() || git_directory.join("rebase-apply").exists() {
        Ok((
            "Rebased onto (ours)".into(),
            "Commit being rebased (theirs)".into(),
        ))
    } else if git_directory.join("CHERRY_PICK_HEAD").exists() {
        Ok((
            "Current branch (ours)".into(),
            "Cherry-picked commit (theirs)".into(),
        ))
    } else if git_directory.join("REVERT_HEAD").exists() {
        Ok((
            "Current branch (ours)".into(),
            "Reverted commit (theirs)".into(),
        ))
    } else {
        Ok(("Local (ours)".into(), "Remote (theirs)".into()))
    }
}

async fn git_output(repository: &Path, args: &[&str]) -> AppResult<Vec<u8>> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
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

async fn run_git(repository: &Path, args: &[&str]) -> AppResult<()> {
    git_output(repository, args).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    use super::*;

    async fn git(repository: &Path, args: &[&str]) -> bool {
        Command::new("git")
            .args(args)
            .current_dir(repository)
            .env("GIT_TERMINAL_PROMPT", "0")
            .output()
            .await
            .expect("run Git")
            .status
            .success()
    }

    #[tokio::test]
    async fn reads_and_resolves_all_three_conflict_stages() {
        let fixture = TempDir::new().expect("fixture");
        let repo = fixture.path();
        assert!(git(repo, &["init", "--initial-branch=main"]).await);
        assert!(git(repo, &["config", "user.name", "Git Client Test"]).await);
        assert!(git(repo, &["config", "user.email", "git-client@example.com"]).await);
        fs::write(repo.join("conflict.txt"), "base\n").expect("write base");
        assert!(git(repo, &["add", "conflict.txt"]).await);
        assert!(git(repo, &["commit", "-m", "base"]).await);
        assert!(git(repo, &["checkout", "-b", "side"]).await);
        fs::write(repo.join("conflict.txt"), "remote\n").expect("write remote");
        assert!(git(repo, &["commit", "-am", "remote"]).await);
        assert!(git(repo, &["checkout", "main"]).await);
        fs::write(repo.join("conflict.txt"), "local\n").expect("write local");
        assert!(git(repo, &["commit", "-am", "local"]).await);
        assert!(!git(repo, &["merge", "side"]).await);

        let conflicts = list_conflicts_in(repo).await.expect("list conflicts");
        assert_eq!(conflicts.len(), 1);
        assert!(!conflicts[0].binary);
        let content = read_conflict_in(repo, "conflict.txt")
            .await
            .expect("read conflict");
        assert_eq!(content.base.as_deref(), Some("base\n"));
        assert_eq!(content.local.as_deref(), Some("local\n"));
        assert_eq!(content.remote.as_deref(), Some("remote\n"));

        write_conflict_result_in(repo, "conflict.txt", "resolved\n")
            .await
            .expect("write result");
        run_git(repo, &["add", "--", "conflict.txt"])
            .await
            .expect("stage result");
        assert!(
            list_conflicts_in(repo)
                .await
                .expect("resolved list")
                .is_empty()
        );
        assert_eq!(
            fs::read_to_string(repo.join("conflict.txt")).unwrap(),
            "resolved\n"
        );
    }
}
