mod changelist;
mod conflict;
mod error;
mod file_content;
mod git;
mod management;
mod model;
mod multi_root;
mod recovery;
pub mod sequence_editor;
mod shelf;
mod terminal;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(git::AppState::default())
        .manage(terminal::TerminalState::default())
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                window.state::<terminal::TerminalState>().close_all();
            }
        })
        .invoke_handler(tauri::generate_handler![
            git::open_repository,
            git::initialize_repository,
            git::clone_repository,
            git::refresh_repository,
            git::execute,
            git::cancel,
            git::watch_repository,
            git::unwatch_repository,
            file_content::read_file,
            file_content::open_working_tree_file,
            terminal::create_terminal,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
            terminal::close_repository_terminals,
            shelf::create_shelf,
            shelf::list_shelves,
            shelf::apply_shelf,
            shelf::delete_shelf,
            recovery::list_recovery_entries,
            recovery::restore_recovery_entry,
            changelist::list_changelists,
            changelist::save_changelist,
            changelist::delete_changelist,
            changelist::commit_changelist,
            conflict::list_conflicts,
            conflict::read_conflict,
            conflict::write_conflict_result,
            conflict::resolve_binary_conflict,
            management::list_remotes,
            management::list_worktrees,
            multi_root::execute_synchronized_branch_operation,
            multi_root::apply_multi_root_rollback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Git Client");
}
