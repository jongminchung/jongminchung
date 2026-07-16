use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread,
};

use portable_pty::{ChildKiller, CommandBuilder, MasterPty, PtySize, native_pty_system};
use tauri::ipc::Channel;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    git::{AppState, repository_record},
    model::{RepositoryId, TerminalEvent, TerminalId},
};

struct TerminalSession {
    repository_id: RepositoryId,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    process_id: Option<u32>,
    terminate_on_drop: bool,
}

impl Drop for TerminalSession {
    fn drop(&mut self) {
        #[cfg(unix)]
        if self.terminate_on_drop
            && let Some(process_id) = self.process_id
        {
            // SAFETY: `process_id` is returned by the spawned PTY child. Failure only means the
            // process already exited; the killer below remains the final cleanup fallback.
            unsafe {
                libc::kill(process_id as libc::pid_t, libc::SIGHUP);
            }
            thread::sleep(std::time::Duration::from_millis(30));
        }
        if self.terminate_on_drop {
            let _ = self.killer.kill();
        }
    }
}

#[derive(Default)]
pub struct TerminalState {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

impl TerminalState {
    pub fn close_all(&self) {
        self.sessions
            .lock()
            .expect("terminal lock poisoned")
            .clear();
    }
}

#[tauri::command]
pub fn create_terminal(
    repository_id: RepositoryId,
    cols: u16,
    rows: u16,
    on_event: Channel<TerminalEvent>,
    git_state: tauri::State<'_, AppState>,
    terminal_state: tauri::State<'_, TerminalState>,
) -> AppResult<TerminalId> {
    validate_size(cols, rows)?;
    let record = repository_record(&git_state, &repository_id)?;
    let pair = native_pty_system()
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(pty_error)?;
    let mut command = CommandBuilder::new_default_prog();
    command.cwd(&record.path);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("TERM_PROGRAM", "GitClient");
    let mut child = pair.slave.spawn_command(command).map_err(pty_error)?;
    let process_id = child.process_id();
    let killer = child.clone_killer();
    let mut reader = pair.master.try_clone_reader().map_err(pty_error)?;
    let writer = pair.master.take_writer().map_err(pty_error)?;
    let terminal_id = TerminalId(Uuid::new_v4().to_string());
    terminal_state
        .sessions
        .lock()
        .expect("terminal lock poisoned")
        .insert(
            terminal_id.0.clone(),
            TerminalSession {
                repository_id,
                master: pair.master,
                writer,
                killer,
                process_id,
                terminate_on_drop: true,
            },
        );

    let reader_channel = on_event.clone();
    let reader_thread = thread::spawn(move || {
        let mut sequence = 0_u64;
        loop {
            let mut buffer = vec![0; 32 * 1024];
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(read) => {
                    buffer.truncate(read);
                    if reader_channel
                        .send(TerminalEvent::Output {
                            sequence,
                            data: buffer,
                        })
                        .is_err()
                    {
                        break;
                    }
                    sequence += 1;
                }
            }
        }
    });
    let sessions = terminal_state.sessions.clone();
    let completed_id = terminal_id.0.clone();
    thread::spawn(move || match child.wait() {
        Ok(status) => {
            let _ = reader_thread.join();
            let _ = on_event.send(TerminalEvent::Exited {
                exit_code: status.exit_code(),
                signal: status.signal().map(str::to_owned),
            });
            remove_completed_session(&sessions, &completed_id);
        }
        Err(error) => {
            let _ = on_event.send(TerminalEvent::Failed {
                message: error.to_string(),
            });
            remove_completed_session(&sessions, &completed_id);
        }
    });
    Ok(terminal_id)
}

#[tauri::command]
pub fn write_terminal(
    terminal_id: TerminalId,
    data: String,
    state: tauri::State<'_, TerminalState>,
) -> AppResult<()> {
    let mut sessions = state.sessions.lock().expect("terminal lock poisoned");
    let session = sessions
        .get_mut(&terminal_id.0)
        .ok_or_else(|| invalid("terminalId", "terminal session does not exist"))?;
    session.writer.write_all(data.as_bytes())?;
    session.writer.flush()?;
    Ok(())
}

#[tauri::command]
pub fn resize_terminal(
    terminal_id: TerminalId,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, TerminalState>,
) -> AppResult<()> {
    validate_size(cols, rows)?;
    let sessions = state.sessions.lock().expect("terminal lock poisoned");
    let session = sessions
        .get(&terminal_id.0)
        .ok_or_else(|| invalid("terminalId", "terminal session does not exist"))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(pty_error)
}

#[tauri::command]
pub fn close_terminal(
    terminal_id: TerminalId,
    state: tauri::State<'_, TerminalState>,
) -> AppResult<()> {
    state
        .sessions
        .lock()
        .expect("terminal lock poisoned")
        .remove(&terminal_id.0);
    Ok(())
}

#[tauri::command]
pub fn close_repository_terminals(
    repository_id: RepositoryId,
    state: tauri::State<'_, TerminalState>,
) -> AppResult<()> {
    state
        .sessions
        .lock()
        .expect("terminal lock poisoned")
        .retain(|_, session| session.repository_id.0 != repository_id.0);
    Ok(())
}

fn validate_size(cols: u16, rows: u16) -> AppResult<()> {
    if !(2..=1_000).contains(&cols) || !(1..=500).contains(&rows) {
        return Err(invalid("terminalSize", "must be within 2x1 and 1000x500"));
    }
    Ok(())
}

fn remove_completed_session(
    sessions: &Arc<Mutex<HashMap<String, TerminalSession>>>,
    terminal_id: &str,
) {
    if let Some(mut session) = sessions
        .lock()
        .expect("terminal lock poisoned")
        .remove(terminal_id)
    {
        session.terminate_on_drop = false;
    }
}

fn pty_error(error: impl std::fmt::Display) -> AppError {
    AppError::Io(std::io::Error::other(error.to_string()))
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

    #[test]
    fn validates_terminal_dimensions() {
        assert!(validate_size(80, 24).is_ok());
        assert!(validate_size(1, 24).is_err());
        assert!(validate_size(80, 0).is_err());
        assert!(validate_size(1_001, 24).is_err());
    }

    #[test]
    fn pty_runs_in_the_repository_and_reports_exit_status() {
        let repository = TempDir::new().expect("repository");
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("pty");
        let mut command = CommandBuilder::new("pwd");
        command.cwd(repository.path());
        let mut child = pair.slave.spawn_command(command).expect("spawn pwd");
        drop(pair.slave);
        pair.master
            .resize(PtySize {
                rows: 36,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("resize");
        let mut reader = pair.master.try_clone_reader().expect("reader");
        let mut output = String::new();
        let _ = reader.read_to_string(&mut output);
        let status = child.wait().expect("wait");

        assert_eq!(status.exit_code(), 0);
        assert!(output.contains(repository.path().to_string_lossy().as_ref()));
    }
}
