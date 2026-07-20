import { useMemo, useState } from "react";
import type { FileChange } from "../domain/types";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";
import { TextArea } from "./ui";

export interface InitialCommitSelection {
  readonly paths: readonly string[];
  readonly message: string;
}

function defaultSelection(files: readonly FileChange[]): ReadonlySet<string> {
  return new Set(files.filter((file) => file.status !== "untracked").map((file) => file.path));
}

export function ShareInitialCommitDialog({
  files,
  onAdd,
  onCancel,
}: {
  readonly files: readonly FileChange[];
  readonly onAdd: (selection: InitialCommitSelection) => void;
  readonly onCancel: () => void;
}) {
  const sortedFiles = useMemo(
    () => [...files].sort((left, right) => left.path.localeCompare(right.path)),
    [files],
  );
  const [selectedPaths, setSelectedPaths] = useState<ReadonlySet<string>>(() =>
    defaultSelection(files),
  );
  const [commitMessage, setCommitMessage] = useState("Initial commit");

  const toggle = (path: string): void => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <Dialog
      aria-label="Add Files For Initial Commit"
      isOpen
      maxHeight="min(720px, calc(100vh - 70px))"
      onOpenChange={(open) => !open && onCancel()}
      padding={0}
      purpose="form"
      width="min(660px, calc(100vw - 70px))"
    >
      <section className={tw.shareInitialCommitDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onCancel()}
          title="Add Files For Initial Commit"
        />
        <header>
          <span>
            {selectedPaths.size} of {sortedFiles.length} files selected
          </span>
          {sortedFiles.length > 0 && (
            <Button
              label={selectedPaths.size === sortedFiles.length ? "Unselect All" : "Select All"}
              onClick={() =>
                setSelectedPaths(
                  selectedPaths.size === sortedFiles.length
                    ? new Set()
                    : new Set(sortedFiles.map((file) => file.path)),
                )
              }
              size="sm"
              variant="ghost"
            />
          )}
        </header>
        <main>
          {sortedFiles.length === 0 ? (
            <p>No files are available for the initial commit.</p>
          ) : (
            <List aria-label="Files for initial commit" density="compact">
              {sortedFiles.map((file) => {
                const selected = selectedPaths.has(file.path);
                return (
                  <ListItem
                    description={file.status}
                    id={`share-initial-${file.path}`}
                    isSelected={selected}
                    key={file.path}
                    label={file.path}
                    onClick={() => toggle(file.path)}
                    startContent={
                      <Icon
                        aria-label={selected ? "Selected" : "Not selected"}
                        name={selected ? "check" : "minus"}
                        size={14}
                      />
                    }
                  />
                );
              })}
            </List>
          )}
        </main>
        <TextArea
          label="Commit Message"
          onChange={setCommitMessage}
          rows={5}
          value={commitMessage}
          width="100%"
        />
        <footer>
          <Button label="Cancel" onClick={onCancel} variant="secondary" />
          <Button
            isDisabled={selectedPaths.size === 0 || commitMessage.trim().length === 0}
            label="Add"
            onClick={() =>
              onAdd({
                paths: sortedFiles
                  .filter((file) => selectedPaths.has(file.path))
                  .map((file) => file.path),
                message: commitMessage.trim(),
              })
            }
            variant="primary"
          />
        </footer>
      </section>
    </Dialog>
  );
}
