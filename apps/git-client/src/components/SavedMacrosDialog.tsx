import { Button } from "@base-ui/react/button";
import type { SavedMacro } from "../domain/macros";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { EmptyState } from "./ui";
import { List, ListItem } from "./ui";

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
                      data-slot="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(macro.id);
                      }}
                      type="button"
                      className={cn(
                        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                      )}
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
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
