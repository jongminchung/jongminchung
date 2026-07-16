use std::{path::Path, process::Stdio};

use tokio::process::Command;

use crate::{
    error::{AppError, AppResult},
    git::{AppState, repository_record},
    model::{RemoteInfo, RepositoryId, WorktreeInfo},
};

#[tauri::command]
pub async fn list_remotes(
    repository_id: RepositoryId,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<RemoteInfo>> {
    let record = repository_record(&state, &repository_id)?;
    let names = git_text(&record.path, &["remote"]).await?;
    let mut remotes = Vec::new();
    for name in names.lines().filter(|name| !name.is_empty()) {
        let fetch_url = git_text(&record.path, &["remote", "get-url", name]).await?;
        let push_url = git_text(&record.path, &["remote", "get-url", "--push", name]).await?;
        remotes.push(RemoteInfo {
            name: name.to_owned(),
            fetch_url: fetch_url.trim().to_owned(),
            push_url: push_url.trim().to_owned(),
        });
    }
    Ok(remotes)
}

#[tauri::command]
pub async fn list_worktrees(
    repository_id: RepositoryId,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<WorktreeInfo>> {
    let record = repository_record(&state, &repository_id)?;
    let output = git_bytes(&record.path, &["worktree", "list", "--porcelain", "-z"]).await?;
    parse_worktrees(&output, &record.path)
}

fn parse_worktrees(output: &[u8], repository: &Path) -> AppResult<Vec<WorktreeInfo>> {
    let repository = repository.canonicalize()?;
    let mut worktrees = Vec::new();
    let mut current: Option<WorktreeInfo> = None;
    for raw_field in output.split(|byte| *byte == 0) {
        let field = std::str::from_utf8(raw_field)
            .map_err(|_| AppError::CommandFailed("non-UTF-8 worktree metadata".into()))?;
        if field.is_empty() {
            if let Some(worktree) = current.take() {
                worktrees.push(worktree);
            }
            continue;
        }
        if let Some(path) = field.strip_prefix("worktree ") {
            if let Some(worktree) = current.take() {
                worktrees.push(worktree);
            }
            let is_main = Path::new(path)
                .canonicalize()
                .is_ok_and(|candidate| candidate == repository);
            current = Some(WorktreeInfo {
                path: path.to_owned(),
                head_oid: None,
                branch: None,
                bare: false,
                detached: false,
                locked: false,
                prunable: false,
                is_main,
            });
        } else if let Some(worktree) = &mut current {
            if let Some(oid) = field.strip_prefix("HEAD ") {
                worktree.head_oid = Some(oid.to_owned());
            } else if let Some(branch) = field.strip_prefix("branch ") {
                worktree.branch = Some(branch.trim_start_matches("refs/heads/").to_owned());
            } else if field == "bare" {
                worktree.bare = true;
            } else if field == "detached" {
                worktree.detached = true;
            } else if field == "locked" || field.starts_with("locked ") {
                worktree.locked = true;
            } else if field == "prunable" || field.starts_with("prunable ") {
                worktree.prunable = true;
            }
        }
    }
    if let Some(worktree) = current {
        worktrees.push(worktree);
    }
    Ok(worktrees)
}

async fn git_text(repository: &Path, args: &[&str]) -> AppResult<String> {
    let output = git_bytes(repository, args).await?;
    String::from_utf8(output).map_err(|_| AppError::CommandFailed("non-UTF-8 Git metadata".into()))
}

async fn git_bytes(repository: &Path, args: &[&str]) -> AppResult<Vec<u8>> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
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

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::*;

    #[test]
    fn parses_porcelain_worktree_records() {
        let fixture = TempDir::new().expect("fixture");
        let main = fixture.path().join("main");
        fs::create_dir(&main).expect("main directory");
        let linked = fixture.path().join("linked path");
        fs::create_dir(&linked).expect("linked directory");
        let output = format!(
            "worktree {}\0HEAD abc\0branch refs/heads/main\0\0worktree {}\0HEAD def\0detached\0locked reason\0\0",
            main.display(),
            linked.display()
        );
        let worktrees = parse_worktrees(output.as_bytes(), &main).expect("parse worktrees");
        assert_eq!(worktrees.len(), 2);
        assert!(worktrees[0].is_main);
        assert!(worktrees[1].detached);
        assert!(worktrees[1].locked);
    }
}
