fn main() {
    if git_client_lib::sequence_editor::run_if_requested() {
        return;
    }
    git_client_lib::run();
}
