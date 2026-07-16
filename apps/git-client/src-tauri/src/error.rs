use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Git 2.39 or newer is required; found {0}")]
    UnsupportedGit(String),
    #[error("Git is not available: {0}")]
    GitUnavailable(String),
    #[error("Repository is not open")]
    RepositoryNotOpen,
    #[error("Not a Git repository: {0}")]
    NotRepository(String),
    #[error("Invalid {field}: {reason}")]
    InvalidInput { field: &'static str, reason: String },
    #[error("Git command failed: {0}")]
    CommandFailed(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid app data: {0}")]
    Json(#[from] serde_json::Error),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
