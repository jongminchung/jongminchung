use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct RepositoryId(pub String);

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct RequestId(pub String);

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GitVersion {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
    pub display: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RepositorySnapshot {
    pub id: RepositoryId,
    pub name: String,
    pub path: String,
    pub git_directory: String,
    pub common_directory: String,
    pub current_branch: Option<String>,
    pub head_oid: Option<String>,
    pub upstream: Option<String>,
    pub remote_url: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub is_bare: bool,
    pub is_shallow: bool,
    pub is_detached: bool,
    pub has_commits: bool,
    pub operation: Option<InProgressOperation>,
    pub git_version: GitVersion,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ShelfFile {
    pub path: String,
    pub checksum: String,
    pub untracked: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ShelfEntry {
    pub id: String,
    pub repository_id: RepositoryId,
    pub message: String,
    pub created_at_ms: u64,
    pub files: Vec<ShelfFile>,
    pub index_patch_checksum: String,
    pub worktree_patch_checksum: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FileWatchEvent {
    pub repository_id: RepositoryId,
    pub paths: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Changelist {
    pub id: String,
    pub repository_id: RepositoryId,
    pub name: String,
    pub paths: Vec<String>,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChangelistCommitResult {
    pub changelist_id: String,
    pub commit_oid: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChangelistCommitOptions {
    pub message: String,
    pub amend: bool,
    pub sign_off: bool,
    pub gpg_sign: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryRef {
    pub name: String,
    pub oid: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryEntry {
    pub id: String,
    pub repository_id: RepositoryId,
    pub operation: String,
    pub created_at_ms: u64,
    pub branch: Option<String>,
    pub head_oid: Option<String>,
    pub refs: Vec<RecoveryRef>,
    pub recoverable: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryRestoreResult {
    pub entry_id: String,
    pub restored_refs: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    pub path: String,
    pub base_oid: Option<String>,
    pub local_oid: Option<String>,
    pub remote_oid: Option<String>,
    pub binary: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConflictContent {
    pub path: String,
    pub base: Option<String>,
    pub local: Option<String>,
    pub remote: Option<String>,
    pub result: Option<String>,
    pub binary: bool,
    pub local_label: String,
    pub remote_label: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub head_oid: Option<String>,
    pub branch: Option<String>,
    pub bare: bool,
    pub detached: bool,
    pub locked: bool,
    pub prunable: bool,
    pub is_main: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MultiRootOutcome {
    pub repository_id: RepositoryId,
    pub path: String,
    pub succeeded: bool,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MultiRootRollbackStep {
    pub repository_id: RepositoryId,
    pub path: String,
    pub description: String,
    pub operations: Vec<GitOperation>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct MultiRootResult {
    pub outcomes: Vec<MultiRootOutcome>,
    pub rollback_plan: Vec<MultiRootRollbackStep>,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum InProgressOperation {
    Merge,
    Rebase,
    CherryPick,
    Revert,
    Bisect,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum LogOrder {
    Date,
    Topology,
    FirstParent,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LogFilters {
    pub query: Option<String>,
    pub branch: Option<String>,
    pub author: Option<String>,
    pub since: Option<String>,
    pub until: Option<String>,
    pub paths: Vec<String>,
    pub no_merges: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum GitRequest {
    Status {
        repository_id: RepositoryId,
    },
    Refs {
        repository_id: RepositoryId,
    },
    Log {
        repository_id: RepositoryId,
        skip: u32,
        limit: u16,
        order: LogOrder,
        filters: LogFilters,
    },
    CommitDetails {
        repository_id: RepositoryId,
        revision: String,
    },
    Diff {
        repository_id: RepositoryId,
        from: Option<String>,
        to: Option<String>,
        paths: Vec<String>,
        staged: bool,
    },
    Tree {
        repository_id: RepositoryId,
        revision: String,
        path: Option<String>,
    },
    FileHistory {
        repository_id: RepositoryId,
        path: String,
        skip: u32,
        limit: u16,
    },
    Blame {
        repository_id: RepositoryId,
        revision: Option<String>,
        path: String,
    },
    Operation {
        repository_id: RepositoryId,
        operation: GitOperation,
    },
}

impl GitRequest {
    pub fn repository_id(&self) -> &RepositoryId {
        match self {
            Self::Status { repository_id }
            | Self::Refs { repository_id }
            | Self::Log { repository_id, .. }
            | Self::CommitDetails { repository_id, .. }
            | Self::Diff { repository_id, .. }
            | Self::Tree { repository_id, .. }
            | Self::FileHistory { repository_id, .. }
            | Self::Blame { repository_id, .. }
            | Self::Operation { repository_id, .. } => repository_id,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum GitOperation {
    Stage {
        paths: Vec<String>,
    },
    Unstage {
        paths: Vec<String>,
    },
    Discard {
        paths: Vec<String>,
    },
    ApplyPatch {
        patch: String,
        cached: bool,
        reverse: bool,
    },
    PartialPatch {
        patch: String,
        cached: bool,
        reverse: bool,
    },
    Commit {
        message: String,
        amend: bool,
        sign_off: bool,
        gpg_sign: bool,
    },
    Fetch {
        remote: Option<String>,
        prune: bool,
    },
    Pull {
        rebase: bool,
    },
    Push {
        remote: Option<String>,
        refspec: Option<String>,
        force_with_lease: bool,
    },
    PushTo {
        remote: String,
        revision: String,
        destination: String,
    },
    CreateBranch {
        name: String,
        start_point: String,
        checkout: bool,
    },
    RenameBranch {
        old_name: String,
        new_name: String,
    },
    DeleteBranch {
        name: String,
        force: bool,
    },
    Checkout {
        target: String,
        force: bool,
    },
    CreateTag {
        name: String,
        revision: String,
        message: Option<String>,
    },
    DeleteTag {
        name: String,
    },
    Reset {
        revision: String,
        mode: ResetMode,
    },
    Revert {
        revisions: Vec<String>,
        no_commit: bool,
    },
    CherryPick {
        revisions: Vec<String>,
        no_commit: bool,
    },
    Merge {
        revision: String,
        no_ff: bool,
        squash: bool,
    },
    Rebase {
        onto: String,
        branch: Option<String>,
    },
    DropCommits {
        revisions: Vec<String>,
    },
    SquashCommits {
        revisions: Vec<String>,
    },
    Continue {
        operation: ContinuableOperation,
    },
    Skip {
        operation: SkippableOperation,
    },
    Abort {
        operation: AbortableOperation,
    },
    StashPush {
        message: Option<String>,
        include_untracked: bool,
        keep_index: bool,
    },
    StashApply {
        stash: String,
        pop: bool,
        reinstate_index: bool,
    },
    StashDrop {
        stash: String,
    },
    WorktreeAdd {
        path: String,
        branch: Option<String>,
        start_point: Option<String>,
    },
    WorktreeRemove {
        path: String,
        force: bool,
    },
    RemoteAdd {
        name: String,
        url: String,
    },
    RemoteRemove {
        name: String,
    },
    RemoteSetUrl {
        name: String,
        url: String,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ResetMode {
    Soft,
    Mixed,
    Hard,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ContinuableOperation {
    Merge,
    Rebase,
    CherryPick,
    Revert,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum SkippableOperation {
    Rebase,
    CherryPick,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum AbortableOperation {
    Merge,
    Rebase,
    CherryPick,
    Revert,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum OutputStream {
    Stdout,
    Stderr,
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum GitEvent {
    Started {
        request_id: RequestId,
        display_command: String,
        started_at_ms: u64,
    },
    Output {
        request_id: RequestId,
        sequence: u64,
        stream: OutputStream,
        data: String,
    },
    Completed {
        request_id: RequestId,
        exit_code: i32,
        duration_ms: u64,
    },
    Failed {
        request_id: RequestId,
        message: String,
        duration_ms: u64,
    },
    Cancelled {
        request_id: RequestId,
        duration_ms: u64,
    },
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use ts_rs::{Config, TS};

    use super::{
        Changelist, ChangelistCommitOptions, ChangelistCommitResult, ConflictContent, ConflictFile,
        FileWatchEvent, GitEvent, GitRequest, MultiRootOutcome, MultiRootResult,
        MultiRootRollbackStep, RecoveryEntry, RecoveryRestoreResult, RemoteInfo,
        RepositorySnapshot, ShelfEntry, WorktreeInfo,
    };

    #[test]
    fn export_bindings() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/generated");
        let config = Config::default()
            .with_out_dir(directory)
            .with_large_int("number");
        GitRequest::export_all(&config).expect("export GitRequest bindings");
        GitEvent::export_all(&config).expect("export GitEvent bindings");
        RepositorySnapshot::export_all(&config).expect("export RepositorySnapshot bindings");
        ShelfEntry::export_all(&config).expect("export ShelfEntry bindings");
        FileWatchEvent::export_all(&config).expect("export FileWatchEvent bindings");
        Changelist::export_all(&config).expect("export Changelist bindings");
        ChangelistCommitResult::export_all(&config)
            .expect("export ChangelistCommitResult bindings");
        ChangelistCommitOptions::export_all(&config)
            .expect("export ChangelistCommitOptions bindings");
        RecoveryEntry::export_all(&config).expect("export RecoveryEntry bindings");
        RecoveryRestoreResult::export_all(&config).expect("export RecoveryRestoreResult bindings");
        ConflictFile::export_all(&config).expect("export ConflictFile bindings");
        ConflictContent::export_all(&config).expect("export ConflictContent bindings");
        RemoteInfo::export_all(&config).expect("export RemoteInfo bindings");
        WorktreeInfo::export_all(&config).expect("export WorktreeInfo bindings");
        MultiRootOutcome::export_all(&config).expect("export MultiRootOutcome bindings");
        MultiRootRollbackStep::export_all(&config).expect("export MultiRootRollbackStep bindings");
        MultiRootResult::export_all(&config).expect("export MultiRootResult bindings");
    }
}
