use std::{path::Path, process::Stdio};

use tokio::process::Command;

use crate::{
    error::{AppError, AppResult},
    git::{AppState, execute_operation_direct, repository_record},
    model::{GitOperation, MultiRootOutcome, MultiRootResult, MultiRootRollbackStep, RepositoryId},
};

#[tauri::command]
pub async fn execute_synchronized_branch_operation(
    repository_ids: Vec<RepositoryId>,
    operation: GitOperation,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<MultiRootResult> {
    validate_synchronized_operation(&operation)?;
    if repository_ids.is_empty() {
        return Err(invalid("repositoryIds", "must not be empty"));
    }
    let mut unique_ids = repository_ids;
    unique_ids.sort_by(|left, right| left.0.cmp(&right.0));
    unique_ids.dedup_by(|left, right| left.0 == right.0);
    let mut outcomes = Vec::with_capacity(unique_ids.len());
    let mut rollback_plan = Vec::new();

    for repository_id in unique_ids {
        let record = repository_record(&state, &repository_id)?;
        let _guard = record.operation_lock.lock().await;
        let previous_branch = git_optional(
            &record.path,
            &["symbolic-ref", "--quiet", "--short", "HEAD"],
        )
        .await;
        let previous_head = git_optional(&record.path, &["rev-parse", "--verify", "HEAD"]).await;
        crate::recovery::record_before_operation(&app, &repository_id, &record.path, &operation)
            .await?;
        match execute_operation_direct(&record.path, &operation).await {
            Ok(()) => {
                outcomes.push(MultiRootOutcome {
                    repository_id: repository_id.clone(),
                    path: record.path.to_string_lossy().into_owned(),
                    succeeded: true,
                    message: "completed".into(),
                });
                if let Some(step) = rollback_for_operation(
                    repository_id,
                    &record.path,
                    &operation,
                    previous_branch,
                    previous_head,
                ) {
                    rollback_plan.insert(0, step);
                }
            }
            Err(error) => {
                outcomes.push(MultiRootOutcome {
                    repository_id,
                    path: record.path.to_string_lossy().into_owned(),
                    succeeded: false,
                    message: error.to_string(),
                });
                break;
            }
        }
    }

    Ok(MultiRootResult {
        outcomes,
        rollback_plan,
    })
}

#[tauri::command]
pub async fn apply_multi_root_rollback(
    steps: Vec<MultiRootRollbackStep>,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<MultiRootOutcome>> {
    let mut outcomes = Vec::with_capacity(steps.len());
    for step in steps {
        validate_rollback_operations(&step.operations)?;
        let record = repository_record(&state, &step.repository_id)?;
        let _guard = record.operation_lock.lock().await;
        let mut result = Ok(());
        for operation in &step.operations {
            if let Err(error) = execute_operation_direct(&record.path, operation).await {
                result = Err(error);
                break;
            }
        }
        match result {
            Ok(()) => outcomes.push(MultiRootOutcome {
                repository_id: step.repository_id,
                path: step.path,
                succeeded: true,
                message: "rollback completed".into(),
            }),
            Err(error) => outcomes.push(MultiRootOutcome {
                repository_id: step.repository_id,
                path: step.path,
                succeeded: false,
                message: error.to_string(),
            }),
        }
    }
    Ok(outcomes)
}

fn validate_synchronized_operation(operation: &GitOperation) -> AppResult<()> {
    match operation {
        GitOperation::Checkout { force: false, .. }
        | GitOperation::CreateBranch { checkout: true, .. } => Ok(()),
        _ => Err(invalid(
            "operation",
            "only non-forced checkout and create-and-checkout branch are synchronized",
        )),
    }
}

fn validate_rollback_operations(operations: &[GitOperation]) -> AppResult<()> {
    if operations.is_empty() || operations.len() > 2 {
        return Err(invalid("operations", "invalid rollback step"));
    }
    for operation in operations {
        match operation {
            GitOperation::Checkout { force: false, .. }
            | GitOperation::DeleteBranch { force: false, .. } => {}
            _ => return Err(invalid("operations", "contains a non-rollback operation")),
        }
    }
    Ok(())
}

fn rollback_for_operation(
    repository_id: RepositoryId,
    repository: &Path,
    operation: &GitOperation,
    previous_branch: Option<String>,
    previous_head: Option<String>,
) -> Option<MultiRootRollbackStep> {
    let target = previous_branch.or(previous_head)?;
    let mut operations = vec![GitOperation::Checkout {
        target: target.clone(),
        force: false,
    }];
    let description = match operation {
        GitOperation::Checkout { .. } => format!("check out {target}"),
        GitOperation::CreateBranch { name, .. } => {
            operations.push(GitOperation::DeleteBranch {
                name: name.clone(),
                force: false,
            });
            format!("check out {target}, then delete {name}")
        }
        _ => return None,
    };
    Some(MultiRootRollbackStep {
        repository_id,
        path: repository.to_string_lossy().into_owned(),
        description,
        operations,
    })
}

async fn git_optional(repository: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repository)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(Stdio::null())
        .output()
        .await
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn invalid(field: &'static str, reason: impl Into<String>) -> AppError {
    AppError::InvalidInput {
        field,
        reason: reason.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_an_inverse_plan_for_a_created_branch() {
        let operation = GitOperation::CreateBranch {
            name: "feat/sync".into(),
            start_point: "HEAD".into(),
            checkout: true,
        };
        let step = rollback_for_operation(
            RepositoryId("repo".into()),
            Path::new("/repo"),
            &operation,
            Some("main".into()),
            Some("abc".into()),
        )
        .expect("rollback step");
        assert_eq!(step.operations.len(), 2);
        assert!(matches!(
            &step.operations[0],
            GitOperation::Checkout { target, .. } if target == "main"
        ));
        assert!(matches!(
            &step.operations[1],
            GitOperation::DeleteBranch { name, .. } if name == "feat/sync"
        ));
    }
}
