import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import type { FileChange } from "../domain/types";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextArea } from "./ProductFormControls";

export interface InitialCommitSelection {
  readonly paths: readonly string[];
  readonly message: string;
}

function defaultSelection(files: readonly FileChange[]): ReadonlySet<string> {
  return new Set(
    files
      .filter((file) => file.status !== "untracked")
      .map((file) => file.path),
  );
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
      <section
        className={`shareInitialCommitDialog [display:grid] [grid-template-rows:auto_32px_minmax(220px,_1fr)_auto_auto] [height:min(640px,_calc(100vh_-_70px))] [&>_header]:[align-items:center] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[color:var(--muted-foreground)] [&>_header]:[display:flex] [&>_header]:[justify-content:space-between] [&>_header]:[padding:0_10px_0_13px] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main>_p]:[color:var(--muted-foreground)] [&>_main>_p]:[margin:18px] [&>_main>_div[role=list]]:[padding:5px_7px] [&>_[data-slot=text-area]]:[border-top:1px_solid_var(--border)] [&>_[data-slot=text-area]]:[padding:10px_12px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[gap:8px] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_10px] shareInitialCommitDialog`}
      >
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
              onClick={() =>
                setSelectedPaths(
                  selectedPaths.size === sortedFiles.length
                    ? new Set()
                    : new Set(sortedFiles.map((file) => file.path)),
                )
              }
              type="button"
              className={cn("h-7 px-2.5")}
              variant="ghost"
              size="sm"
            >
              {selectedPaths.size === sortedFiles.length
                ? "Unselect All"
                : "Select All"}
            </Button>
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
          <Button
            onClick={onCancel}
            type="button"
            className={cn("h-8 px-3")}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              onAdd({
                paths: sortedFiles
                  .filter((file) => selectedPaths.has(file.path))
                  .map((file) => file.path),
                message: commitMessage.trim(),
              })
            }
            type="button"
            disabled={
              selectedPaths.size === 0 || commitMessage.trim().length === 0
            }
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Add
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
