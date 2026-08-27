import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { toVoidHandler } from "../../domain/toVoidHandler";
import type { ShelfEntry } from "../../shared/contracts/model/index";
import type { AppDialogController } from "../AppDialog";
import { Icon } from "../Icon";
import { Notice } from "../Notice";

export function ShelfSurface({
  dialog,
  loadError,
  onApply,
  onCreate,
  onDelete,
  shelves,
}: {
  readonly dialog: AppDialogController;
  readonly loadError?: string;
  readonly onApply: (shelfId: string, drop: boolean) => void;
  readonly onCreate: () => Promise<void>;
  readonly onDelete: (shelfId: string) => void;
  readonly shelves: readonly ShelfEntry[];
}) {
  return (
    <div
      className={`collectionTool collectionTool [height:100%] [overflow:auto] [&_button]:[height:27px] [&_button]:rounded-sm [&_button]:[padding:0_9px] [&_button]:[white-space:nowrap] [&_button]:[background:var(--muted)] [&_button]:[border:1px_solid_var(--border)]`}
    >
      <div
        className={`collectionIntro collectionIntro [display:flex] [min-height:48px] [align-items:center] [gap:10px] [padding:8px_14px] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [&_div]:[flex:1] [&_p]:[margin:2px_0_0] [&_p]:[color:var(--muted-foreground)]`}
      >
        <Icon name="shelf" size={24} />
        <div>
          <strong>Shelf</strong>
          <p>
            Index, worktree, and untracked files are stored atomically outside
            the repository.
          </p>
        </div>
        <Button
          onClick={() => void onCreate()}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Shelve Changes…
        </Button>
      </div>
      {loadError && (
        <Notice
          className="rounded-none border-x-0 px-3.5 py-1.5"
          role="alert"
          size="sm"
          tone="destructive"
        >
          {loadError}
        </Notice>
      )}
      {shelves.map((shelf) => (
        <div
          className={`collectionRow collectionRow [display:flex] [min-height:48px] [align-items:center] [gap:10px] [padding:8px_14px] [border-bottom:0] [border-bottom:1px_solid_var(--border)] [&_div]:[flex:1] [&_small]:[margin-top:3px] [&_small]:[display:block] [&_small]:[color:var(--disabled-foreground)]`}
          key={shelf.id}
        >
          <Icon name="patch" size={16} />
          <div>
            <strong>{shelf.message}</strong>
            <small>
              {new Date(shelf.createdAtMs).toLocaleString()} ·{" "}
              {shelf.files.length} files · checksum verified
            </small>
          </div>
          <Button
            onClick={() => onApply(shelf.id, false)}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Apply
          </Button>
          <Button
            onClick={() => onApply(shelf.id, true)}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Unshelve
          </Button>
          <Button
            aria-label={`Delete ${shelf.message}`}
            onClick={toVoidHandler(async () => {
              const accepted = await dialog.confirm({
                title: `Delete shelf “${shelf.message}”?`,
                description:
                  "The stored patches and untracked file copies will be deleted.",
                impact: `${shelf.files.length} files`,
                confirmLabel: "Delete shelf",
                dangerous: true,
              });
              if (accepted) onDelete(shelf.id);
            })}
            type="button"
            className="text-muted-foreground"
            variant="ghost"
            size="icon-sm"
          >
            <Icon name="trash" size={13} />
          </Button>
        </div>
      ))}
    </div>
  );
}
