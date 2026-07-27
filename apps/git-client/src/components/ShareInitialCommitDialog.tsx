import { Button } from "@base-ui/react/button";
import { useMemo, useState } from "react";
import type { FileChange } from "../domain/types";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
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
              data-slot="button"
              onClick={() =>
                setSelectedPaths(
                  selectedPaths.size === sortedFiles.length
                    ? new Set()
                    : new Set(sortedFiles.map((file) => file.path)),
                )
              }
              type="button"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
              )}
            >
              {selectedPaths.size === sortedFiles.length ? "Unselect All" : "Select All"}
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
            data-slot="button"
            onClick={onCancel}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
            )}
          >
            Cancel
          </Button>
          <Button
            data-slot="button"
            onClick={() =>
              onAdd({
                paths: sortedFiles
                  .filter((file) => selectedPaths.has(file.path))
                  .map((file) => file.path),
                message: commitMessage.trim(),
              })
            }
            type="button"
            disabled={selectedPaths.size === 0 || commitMessage.trim().length === 0}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Add
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
