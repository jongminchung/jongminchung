use std::{env, fs, path::Path};

use crate::error::{AppError, AppResult};

pub fn run_if_requested() -> bool {
    let mut arguments = env::args();
    let _executable = arguments.next();
    if arguments.next().as_deref() != Some("--sequence-editor") {
        return false;
    }
    let result = arguments
        .next()
        .ok_or_else(|| invalid("missing rebase todo path"))
        .and_then(|path| rewrite_todo_file(Path::new(&path)));
    if let Err(error) = result {
        eprintln!("Git Client sequence editor: {error}");
        std::process::exit(2);
    }
    true
}

fn rewrite_todo_file(path: &Path) -> AppResult<()> {
    let action =
        env::var("GIT_CLIENT_REBASE_ACTION").map_err(|_| invalid("missing rebase action"))?;
    let revisions =
        env::var("GIT_CLIENT_REBASE_OIDS").map_err(|_| invalid("missing selected revisions"))?;
    let revisions: Vec<&str> = revisions
        .split(',')
        .filter(|value| !value.is_empty())
        .collect();
    let todo = fs::read_to_string(path)?;
    let rewritten = rewrite_todo(&todo, &action, &revisions)?;
    fs::write(path, rewritten)?;
    Ok(())
}

fn rewrite_todo(todo: &str, action: &str, revisions: &[&str]) -> AppResult<String> {
    if revisions.is_empty() {
        return Err(invalid("no selected revisions"));
    }
    let mut commit_position = 0_usize;
    let mut selected_positions = Vec::new();
    let mut parsed = Vec::new();
    for line in todo.lines() {
        let mut fields = line.split_whitespace();
        let command = fields.next().unwrap_or_default();
        let oid = fields.next().unwrap_or_default();
        let is_commit = matches!(
            command,
            "pick" | "p" | "reword" | "edit" | "squash" | "fixup"
        );
        let selected = is_commit
            && revisions
                .iter()
                .any(|selected| selected.starts_with(oid) || oid.starts_with(selected));
        if selected {
            selected_positions.push(commit_position);
        }
        if is_commit {
            commit_position += 1;
        }
        parsed.push((line, command, selected));
    }
    if selected_positions.len() != revisions.len() {
        return Err(invalid(
            "not every selected commit is present in the rebase plan",
        ));
    }
    if action == "squash"
        && selected_positions
            .windows(2)
            .any(|positions| positions[1] != positions[0] + 1)
    {
        return Err(invalid("squash commits must be contiguous"));
    }

    let mut first_selected = true;
    let mut output = Vec::new();
    for (line, command, selected) in parsed {
        if !selected {
            output.push(line.to_owned());
        } else if action == "drop" {
            continue;
        } else if action == "squash" {
            if first_selected {
                output.push(line.to_owned());
                first_selected = false;
            } else {
                output.push(line.replacen(command, "squash", 1));
            }
        } else {
            return Err(invalid("unsupported rebase action"));
        }
    }
    Ok(format!("{}\n", output.join("\n")))
}

fn invalid(reason: impl Into<String>) -> AppError {
    AppError::InvalidInput {
        field: "sequenceEditor",
        reason: reason.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::rewrite_todo;

    #[test]
    fn drops_only_selected_commits() {
        let todo = "pick aaa first\npick bbb second\npick ccc third\n";
        assert_eq!(
            rewrite_todo(todo, "drop", &["bbbbbbbb"]).expect("drop todo"),
            "pick aaa first\npick ccc third\n"
        );
    }

    #[test]
    fn squashes_a_contiguous_range_into_its_oldest_commit() {
        let todo = "pick aaa first\npick bbb second\npick ccc third\n";
        assert_eq!(
            rewrite_todo(todo, "squash", &["bbbb", "cccc"]).expect("squash todo"),
            "pick aaa first\npick bbb second\nsquash ccc third\n"
        );
    }

    #[test]
    fn rejects_non_contiguous_squash() {
        let todo = "pick aaa first\npick bbb second\npick ccc third\n";
        assert!(rewrite_todo(todo, "squash", &["aaaa", "cccc"]).is_err());
    }
}
