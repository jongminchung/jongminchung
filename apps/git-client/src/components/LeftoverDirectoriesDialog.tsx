import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import { useCallback, useEffect, useState } from "react";
import type { DiagnosticLeftoverDirectory } from "../shared/contracts/ipc";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { Icon } from "./Icon";

function sizeLabel(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KiB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MiB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GiB`;
}

export function LeftoverDirectoriesDialog({
  deleteDirectories,
  loadDirectories,
  onClose,
}: {
  readonly deleteDirectories: (ids: readonly string[]) => Promise<readonly string[]>;
  readonly loadDirectories: () => Promise<readonly DiagnosticLeftoverDirectory[]>;
  readonly onClose: () => void;
}) {
  const dialog = useAppDialog();
  const [directories, setDirectories] = useState<readonly DiagnosticLeftoverDirectory[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setDirectories(await loadDirectories());
      setSelected(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [loadDirectories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setDirectorySelected = (id: string, checked: boolean): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const removeSelected = async (): Promise<void> => {
    const ids = directories
      .filter((directory) => selected.has(directory.id))
      .map((directory) => directory.id);
    if (ids.length === 0) return;
    const confirmed = await dialog.confirm({
      title: "Delete Leftover IDE Directories?",
      description: `Delete ${ids.length} selected Git Client profile director${ids.length === 1 ? "y" : "ies"}?`,
      impact: ids.join("\n"),
      confirmLabel: "Delete",
      dangerous: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDirectories(ids);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog
        aria-label="Delete Leftover IDE Directories"
        isOpen
        maxHeight="min(680px, calc(100vh - 70px))"
        onOpenChange={(open) => !open && onClose()}
        padding={0}
        purpose="form"
        width="min(720px, calc(100vw - 70px))"
      >
        <section className={tw.leftoverDirectoriesDialog}>
          <DialogHeader
            hasDivider
            onOpenChange={(open) => !open && onClose()}
            title="Delete Leftover IDE Directories"
          />
          <p>
            Select obsolete Git Client Electron profiles to delete. The active and primary
            profiles, plus data from other applications, are never listed.
          </p>
          <header aria-hidden="true">
            <span>Name</span>
            <span>Last Updated</span>
            <span>Size</span>
          </header>
          <main>
            {error ? (
              <EmptyState title={error} />
            ) : loading ? (
              <EmptyState title="Looking for leftover directories…" />
            ) : directories.length === 0 ? (
              <EmptyState title="No leftover IDE directories found" />
            ) : (
              <List aria-label="Leftover IDE directories" density="compact" role="list">
                {directories.map((directory) => (
                  <ListItem
                    description="Obsolete Git Client Electron profile"
                    endContent={
                      <span className={tw.leftoverDirectoryMetrics}>
                        <time dateTime={new Date(directory.lastModifiedMs).toISOString()}>
                          {new Date(directory.lastModifiedMs).toLocaleDateString()}
                        </time>
                        <span>{sizeLabel(directory.sizeBytes)}</span>
                      </span>
                    }
                    key={directory.id}
                    label={directory.name}
                    onClick={() => setDirectorySelected(directory.id, !selected.has(directory.id))}
                    role="listitem"
                    startContent={
                      <CheckboxInput
                        isDisabled={deleting}
                        isLabelHidden
                        label={`Delete ${directory.name}`}
                        onChange={(checked, event) => {
                          event.stopPropagation();
                          setDirectorySelected(directory.id, checked);
                        }}
                        size="sm"
                        value={selected.has(directory.id)}
                      />
                    }
                  />
                ))}
              </List>
            )}
          </main>
          <footer>
            <span>{selected.size} selected</span>
            <Button label="Cancel" onClick={onClose} variant="secondary" />
            <Button
              isDisabled={selected.size === 0 || deleting}
              label={deleting ? "Deleting…" : "Delete"}
              onClick={() => void removeSelected()}
              variant="destructive"
            />
          </footer>
        </section>
      </Dialog>
      {dialog.node}
    </>
  );
}
