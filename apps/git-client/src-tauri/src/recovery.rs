use std::{
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
    git::{AppState, repository_record, validate_ref_name},
    model::{GitOperation, RecoveryEntry, RecoveryRef, RecoveryRestoreResult, RepositoryId},
};

const MAX_ENTRIES: usize = 200;

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecoveryManifest {
    entries: Vec<RecoveryEntry>,
}

pub(crate) async fn record_before_operation(
    app: &tauri::AppHandle,
    repository_id: &RepositoryId,
    repository: &Path,
    operation: &GitOperation,
) -> AppResult<Option<RecoveryEntry>> {
    let branch = capture_optional(repository, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .await
        .map(trimmed);
    let Some((label, ref_names)) = affected_refs(operation, branch.as_deref()) else {
        return Ok(None);
    };
    let mut refs = Vec::with_capacity(ref_names.len());
    for name in ref_names {
        refs.push(RecoveryRef {
            oid: capture_optional(repository, &["rev-parse", "--verify", &name])
                .await
                .map(trimmed),
            name,
        });
    }
    let entry = RecoveryEntry {
        id: Uuid::new_v4().to_string(),
        repository_id: repository_id.clone(),
        operation: label,
        created_at_ms: now_ms(),
        branch,
        head_oid: capture_optional(repository, &["rev-parse", "--verify", "HEAD"])
            .await
            .map(trimmed),
        refs,
        recoverable: true,
    };
    append_entry(app, &entry)?;
    Ok(Some(entry))
}

#[tauri::command]
pub async fn list_recovery_entries(
    repository_id: RepositoryId,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<RecoveryEntry>> {
    let record = repository_record(&state, &repository_id)?;
    let mut entries = read_manifest(&app, &repository_id)?.entries;
    for entry in &mut entries {
        entry.recoverable = refs_are_recoverable(&record.path, &entry.refs).await;
    }
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.created_at_ms));
    Ok(entries)
}

#[tauri::command]
pub async fn restore_recovery_entry(
    repository_id: RepositoryId,
    entry_id: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<RecoveryRestoreResult> {
    validate_uuid(&entry_id, "entryId")?;
    let record = repository_record(&state, &repository_id)?;
    let _guard = record.operation_lock.lock().await;
    let manifest = read_manifest(&app, &repository_id)?;
    let entry = manifest
        .entries
        .into_iter()
        .find(|entry| entry.id == entry_id)
        .ok_or_else(|| invalid("entryId", "recovery entry does not exist"))?;
    if !refs_are_recoverable(&record.path, &entry.refs).await {
        return Err(invalid(
            "entryId",
            "one or more recorded objects are no longer available",
        ));
    }

    let ref_names = entry
        .refs
        .iter()
        .map(|reference| reference.name.clone())
        .collect::<Vec<_>>();
    let inverse = capture_entry(
        &repository_id,
        &record.path,
        format!("restore {}", entry.operation),
        ref_names,
    )
    .await?;
    append_entry(&app, &inverse)?;
    let restored_refs = restore_refs(&record.path, &entry.refs).await?;
    Ok(RecoveryRestoreResult {
        entry_id,
        restored_refs,
    })
}

async fn capture_entry(
    repository_id: &RepositoryId,
    repository: &Path,
    operation: String,
    ref_names: Vec<String>,
) -> AppResult<RecoveryEntry> {
    let mut refs = Vec::new();
    for name in ref_names {
        refs.push(RecoveryRef {
            oid: capture_optional(repository, &["rev-parse", "--verify", &name])
                .await
                .map(trimmed),
            name,
        });
    }
    Ok(RecoveryEntry {
        id: Uuid::new_v4().to_string(),
        repository_id: repository_id.clone(),
        operation,
        created_at_ms: now_ms(),
        branch: capture_optional(repository, &["symbolic-ref", "--quiet", "--short", "HEAD"])
            .await
            .map(trimmed),
        head_oid: capture_optional(repository, &["rev-parse", "--verify", "HEAD"])
            .await
            .map(trimmed),
        refs,
        recoverable: true,
    })
}

async fn restore_refs(repository: &Path, refs: &[RecoveryRef]) -> AppResult<Vec<String>> {
    let mut restored = Vec::with_capacity(refs.len());
    for reference in refs {
        validate_ref_name(&reference.name, "recoveryRef")?;
        let current = capture_optional(repository, &["rev-parse", "--verify", &reference.name])
            .await
            .map(trimmed);
        match (&reference.oid, current) {
            (Some(target), Some(current)) if target != &current => {
                run_git(
                    repository,
                    &["update-ref", &reference.name, target, &current],
                )
                .await?;
                restored.push(reference.name.clone());
            }
            (Some(target), None) => {
                run_git(
                    repository,
                    &[
                        "update-ref",
                        &reference.name,
                        target,
                        "0000000000000000000000000000000000000000",
                    ],
                )
                .await?;
                restored.push(reference.name.clone());
            }
            (None, Some(current)) => {
                run_git(
                    repository,
                    &["update-ref", "--delete", &reference.name, &current],
                )
                .await?;
                restored.push(reference.name.clone());
            }
            _ => {}
        }
    }
    Ok(restored)
}

async fn refs_are_recoverable(repository: &Path, refs: &[RecoveryRef]) -> bool {
    for oid in refs.iter().filter_map(|reference| reference.oid.as_deref()) {
        let object = format!("{oid}^{{object}}");
        if capture_optional(repository, &["cat-file", "-e", &object])
            .await
            .is_none()
        {
            return false;
        }
    }
    true
}

fn affected_refs(operation: &GitOperation, branch: Option<&str>) -> Option<(String, Vec<String>)> {
    let current = || branch.map(|name| format!("refs/heads/{name}"));
    let current_only = |label: &str| Some((label.to_owned(), vec![current()?]));
    match operation {
        GitOperation::Commit { .. } => current_only("commit"),
        GitOperation::Reset { .. } => current_only("reset"),
        GitOperation::Revert { .. } => current_only("revert"),
        GitOperation::CherryPick { .. } => current_only("cherry-pick"),
        GitOperation::Merge { .. } => current_only("merge"),
        GitOperation::Rebase { .. } => current_only("rebase"),
        GitOperation::DropCommits { .. } => current_only("drop commits"),
        GitOperation::SquashCommits { .. } => current_only("squash commits"),
        GitOperation::Continue { .. } => current_only("continue operation"),
        GitOperation::Skip { .. } => current_only("skip operation"),
        GitOperation::Abort { .. } => current_only("abort operation"),
        GitOperation::CreateBranch { name, .. } => {
            Some(("create branch".into(), vec![format!("refs/heads/{name}")]))
        }
        GitOperation::RenameBranch {
            old_name, new_name, ..
        } => Some((
            "rename branch".into(),
            vec![
                format!("refs/heads/{old_name}"),
                format!("refs/heads/{new_name}"),
            ],
        )),
        GitOperation::DeleteBranch { name, .. } => {
            Some(("delete branch".into(), vec![format!("refs/heads/{name}")]))
        }
        GitOperation::CreateTag { name, .. } => {
            Some(("create tag".into(), vec![format!("refs/tags/{name}")]))
        }
        GitOperation::DeleteTag { name } => {
            Some(("delete tag".into(), vec![format!("refs/tags/{name}")]))
        }
        GitOperation::StashPush { .. }
        | GitOperation::StashApply { .. }
        | GitOperation::StashDrop { .. } => Some(("stash".into(), vec!["refs/stash".into()])),
        _ => None,
    }
}

fn append_entry(app: &tauri::AppHandle, entry: &RecoveryEntry) -> AppResult<()> {
    let mut manifest = read_manifest(app, &entry.repository_id)?;
    manifest.entries.insert(0, entry.clone());
    manifest.entries.truncate(MAX_ENTRIES);
    write_manifest(app, &entry.repository_id, &manifest)
}

fn read_manifest(
    app: &tauri::AppHandle,
    repository_id: &RepositoryId,
) -> AppResult<RecoveryManifest> {
    let path = manifest_path(app, repository_id)?;
    if !path.exists() {
        return Ok(RecoveryManifest::default());
    }
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}

fn write_manifest(
    app: &tauri::AppHandle,
    repository_id: &RepositoryId,
    manifest: &RecoveryManifest,
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
        .join("recovery")
        .join(format!("{}.json", repository_id.0)))
}

async fn capture_optional(repository: &Path, args: &[&str]) -> Option<String> {
    let output = git_command(repository, args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .await
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

async fn run_git(repository: &Path, args: &[&str]) -> AppResult<()> {
    let output = git_command(repository, args).output().await?;
    if output.status.success() {
        Ok(())
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
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command
}

fn validate_uuid(value: &str, field: &'static str) -> AppResult<()> {
    Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| invalid(field, "must be a UUID"))
}

fn trimmed(value: String) -> String {
    value.trim().to_owned()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
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

    async fn git(repository: &Path, args: &[&str]) {
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
    }

    #[test]
    fn records_only_refs_affected_by_an_operation() {
        let operation = GitOperation::RenameBranch {
            old_name: "main".into(),
            new_name: "trunk".into(),
        };
        let (_, refs) = affected_refs(&operation, Some("main")).expect("recovery refs");
        assert_eq!(refs, ["refs/heads/main", "refs/heads/trunk"]);
        assert!(
            affected_refs(
                &GitOperation::Fetch {
                    remote: None,
                    prune: false
                },
                None
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn restores_a_recorded_branch_oid_with_compare_and_swap() {
        let directory = TempDir::new().expect("tempdir");
        git(directory.path(), &["init", "--initial-branch=main"]).await;
        git(directory.path(), &["config", "user.name", "Test"]).await;
        git(
            directory.path(),
            &["config", "user.email", "test@example.com"],
        )
        .await;
        fs::write(directory.path().join("file.txt"), "one\n").expect("write file");
        git(directory.path(), &["add", "file.txt"]).await;
        git(directory.path(), &["commit", "-m", "one"]).await;
        let first = capture_optional(directory.path(), &["rev-parse", "HEAD"])
            .await
            .map(trimmed)
            .expect("first oid");
        fs::write(directory.path().join("file.txt"), "two\n").expect("write file");
        git(directory.path(), &["commit", "-am", "two"]).await;

        let restored = restore_refs(
            directory.path(),
            &[RecoveryRef {
                name: "refs/heads/main".into(),
                oid: Some(first.clone()),
            }],
        )
        .await
        .expect("restore ref");
        assert_eq!(restored, ["refs/heads/main"]);
        assert_eq!(
            capture_optional(directory.path(), &["rev-parse", "HEAD"])
                .await
                .map(trimmed),
            Some(first)
        );
    }
}
