use std::path::{Path, PathBuf};

use tauri_plugin_opener::OpenerExt;
use tokio::process::Command;

use crate::{
    error::{AppError, AppResult},
    git::{AppState, repository_record, validate_relative_path, validate_revision},
    model::{FileContent, FileSource, RepositoryId},
};

const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_FILE_LINES: u32 = 50_000;

enum ReadResult {
    Bytes(Vec<u8>),
    TooLarge(u64),
    Missing,
}

#[tauri::command]
pub async fn read_file(
    repository_id: RepositoryId,
    source: FileSource,
    path: String,
    state: tauri::State<'_, AppState>,
) -> AppResult<FileContent> {
    validate_relative_path(&path)?;
    let record = repository_record(&state, &repository_id)?;
    let result = match source {
        FileSource::WorkingTree => read_working_tree(&record.path, &path)?,
        FileSource::Index => read_git_object(&record.path, &format!(":{path}"), &path).await?,
        FileSource::Revision { revision } => {
            validate_revision(&revision, "revision")?;
            read_git_object(&record.path, &format!("{revision}:{path}"), &path).await?
        }
    };
    Ok(match result {
        ReadResult::Bytes(bytes) => classify_content(path, bytes),
        ReadResult::TooLarge(size_bytes) => FileContent::TooLarge {
            path,
            size_bytes,
            line_count: None,
        },
        ReadResult::Missing => FileContent::Missing { path },
    })
}

#[tauri::command]
pub fn open_working_tree_file(
    repository_id: RepositoryId,
    path: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> AppResult<()> {
    validate_relative_path(&path)?;
    let record = repository_record(&state, &repository_id)?;
    let Some(canonical) = resolve_working_tree_file(&record.path, &path)? else {
        return Err(AppError::InvalidInput {
            field: "path",
            reason: "file does not exist".into(),
        });
    };
    app.opener()
        .open_path(canonical.to_string_lossy(), None::<String>)
        .map_err(|error| AppError::CommandFailed(error.to_string()))
}

fn read_working_tree(root: &Path, path: &str) -> AppResult<ReadResult> {
    let Some(canonical) = resolve_working_tree_file(root, path)? else {
        return Ok(ReadResult::Missing);
    };
    let metadata = canonical.metadata()?;
    if metadata.len() > MAX_FILE_BYTES {
        return Ok(ReadResult::TooLarge(metadata.len()));
    }
    Ok(ReadResult::Bytes(std::fs::read(canonical)?))
}

fn resolve_working_tree_file(root: &Path, path: &str) -> AppResult<Option<PathBuf>> {
    let canonical_root = root.canonicalize()?;
    let candidate = root.join(path);
    if !candidate.exists() {
        return Ok(None);
    }
    let canonical = candidate.canonicalize()?;
    if !canonical.starts_with(&canonical_root) {
        return Err(AppError::InvalidInput {
            field: "path",
            reason: "resolves outside the repository".into(),
        });
    }
    if !canonical.metadata()?.is_file() {
        return Ok(None);
    }
    Ok(Some(canonical))
}

async fn read_git_object(root: &Path, object: &str, path: &str) -> AppResult<ReadResult> {
    let size = git_output(root, &["cat-file", "-s", object]).await?;
    let Some(size) = size else {
        return Ok(ReadResult::Missing);
    };
    let size = String::from_utf8_lossy(&size)
        .trim()
        .parse::<u64>()
        .map_err(|_| AppError::CommandFailed(format!("Git returned an invalid size for {path}")))?;
    if size > MAX_FILE_BYTES {
        return Ok(ReadResult::TooLarge(size));
    }
    Ok(
        match git_output(root, &["cat-file", "blob", object]).await? {
            Some(bytes) => ReadResult::Bytes(bytes),
            None => ReadResult::Missing,
        },
    )
}

async fn git_output(root: &Path, args: &[&str]) -> AppResult<Option<Vec<u8>>> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_PAGER", "cat")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .await?;
    Ok(output.status.success().then_some(output.stdout))
}

fn classify_content(path: String, bytes: Vec<u8>) -> FileContent {
    let size_bytes = bytes.len() as u64;
    if size_bytes > MAX_FILE_BYTES {
        return FileContent::TooLarge {
            path,
            size_bytes: size_bytes.max(MAX_FILE_BYTES + 1),
            line_count: None,
        };
    }
    if bytes.contains(&0) {
        return FileContent::Binary { path, size_bytes };
    }
    let Ok(content) = String::from_utf8(bytes) else {
        return FileContent::InvalidUtf8 { path, size_bytes };
    };
    let line_count = if content.is_empty() {
        0
    } else {
        content.bytes().filter(|byte| *byte == b'\n').count() as u32
            + u32::from(!content.ends_with('\n'))
    };
    if line_count > MAX_FILE_LINES {
        return FileContent::TooLarge {
            path,
            size_bytes,
            line_count: Some(line_count),
        };
    }
    FileContent::Text {
        path,
        content,
        size_bytes,
        line_count,
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, os::unix::fs::symlink, process::Command};

    use tempfile::TempDir;

    use super::*;

    #[test]
    fn classifies_text_binary_invalid_utf8_and_large_files() {
        assert!(matches!(
            classify_content("text.txt".into(), b"first\nsecond\n".to_vec()),
            FileContent::Text { line_count: 2, .. }
        ));
        assert!(matches!(
            classify_content("image.bin".into(), vec![1, 0, 2]),
            FileContent::Binary { .. }
        ));
        assert!(matches!(
            classify_content("legacy.txt".into(), vec![0xff, 0xfe]),
            FileContent::InvalidUtf8 { .. }
        ));
        assert!(matches!(
            classify_content("large.txt".into(), vec![b'a'; MAX_FILE_BYTES as usize + 1]),
            FileContent::TooLarge { .. }
        ));
    }

    #[test]
    fn rejects_working_tree_symlink_escape() {
        let fixture = TempDir::new().expect("fixture");
        let root = fixture.path().join("repository");
        let outside = fixture.path().join("outside.txt");
        fs::create_dir(&root).expect("repository directory");
        fs::write(&outside, "secret").expect("outside file");
        symlink(&outside, root.join("link.txt")).expect("symlink");

        assert!(matches!(
            read_working_tree(&root, "link.txt"),
            Err(AppError::InvalidInput { field: "path", .. })
        ));
    }

    #[tokio::test]
    async fn reads_working_tree_index_and_revision_with_unicode_paths() {
        let fixture = TempDir::new().expect("fixture");
        let root = fixture.path();
        git(root, &["init"]);
        git(root, &["config", "user.name", "Test User"]);
        git(root, &["config", "user.email", "test@example.com"]);
        let path = "한글 file.txt";
        fs::write(root.join(path), "committed\n").expect("write initial file");
        git(root, &["add", "--", path]);
        git(root, &["commit", "-m", "initial"]);
        fs::write(root.join(path), "working tree\n").expect("write worktree file");

        assert!(matches!(
            read_working_tree(root, path).expect("worktree"),
            ReadResult::Bytes(bytes) if bytes == b"working tree\n"
        ));
        assert!(matches!(
            read_git_object(root, &format!(":{path}"), path)
                .await
                .expect("index"),
            ReadResult::Bytes(bytes) if bytes == b"committed\n"
        ));
        assert!(matches!(
            read_git_object(root, &format!("HEAD:{path}"), path)
                .await
                .expect("revision"),
            ReadResult::Bytes(bytes) if bytes == b"committed\n"
        ));
    }

    fn git(root: &Path, args: &[&str]) {
        let status = Command::new("git")
            .args(args)
            .current_dir(root)
            .status()
            .expect("run git");
        assert!(status.success(), "git {args:?}");
    }
}
