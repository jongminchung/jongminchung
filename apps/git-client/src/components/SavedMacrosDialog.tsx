import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import type { SavedMacro } from "../domain/macros";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

export function SavedMacrosDialog({
  macros,
  onClose,
  onDelete,
  onPlay,
}: {
  readonly macros: readonly SavedMacro[];
  readonly onClose: () => void;
  readonly onDelete: (macroId: string) => void;
  readonly onPlay: (macro: SavedMacro) => Promise<void>;
}) {
  return (
    <Dialog
      aria-label="Play Saved Macros"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={520}
    >
      <section className={tw.savedMacrosDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title="Play Saved Macros" />
        <main>
          {macros.length === 0 ? (
            <EmptyState description="Record commands with Edit > Macros > Start Macro Recording." title="No saved macros" />
          ) : (
            <List aria-label="Saved macros" density="compact">
              {macros.map((macro) => (
                <ListItem
                  description={`${macro.commandIds.length} command${macro.commandIds.length === 1 ? "" : "s"}`}
                  endContent={
                    <Button
                      icon={<Icon name="trash" size={13} />}
                      label={`Delete ${macro.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(macro.id);
                      }}
                      size="sm"
                      variant="ghost"
                    />
                  }
                  id={`saved-macro-${macro.id}`}
                  key={macro.id}
                  label={macro.name}
                  onClick={() => void onPlay(macro)}
                />
              ))}
            </List>
          )}
        </main>
        <footer><Button label="Close" onClick={onClose} variant="primary" /></footer>
      </section>
    </Dialog>
  );
}
