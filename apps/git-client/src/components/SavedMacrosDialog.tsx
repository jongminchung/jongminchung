import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type { SavedMacro } from "../domain/macros";
import { Icon } from "./Icon";
import { EmptyState } from "./ProductCollections";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
      <section
        className={`savedMacrosDialog savedMacrosDialog [display:grid] [max-height:min(560px,_calc(100vh_-_80px))] [grid-template-rows:auto_minmax(240px,_1fr)_auto] [&>_footer]:[display:flex] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_10px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main]:[padding:6px]`}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Play Saved Macros"
        />
        <main>
          {macros.length === 0 ? (
            <EmptyState
              description="Record commands with Edit > Macros > Start Macro Recording."
              title="No saved macros"
            />
          ) : (
            <List aria-label="Saved macros" density="compact">
              {macros.map((macro) => (
                <ListItem
                  description={`${macro.commandIds.length} command${macro.commandIds.length === 1 ? "" : "s"}`}
                  endContent={
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(macro.id);
                      }}
                      type="button"
                      className={cn("h-7 px-2.5")}
                      variant="ghost"
                      size="sm"
                    >
                      <Icon name="trash" size={13} />
                      {`Delete ${macro.name}`}
                    </Button>
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
        <footer>
          <Button
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
