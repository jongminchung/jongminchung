import { Button } from "@jongminchung/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import type { ChangeEntry, CommitDraft } from "../../domain/changeReview";
import type { Changelist } from "../../shared/contracts/model/index";
import { useDismissLayer } from "../CommandProvider";
import { Icon } from "../Icon";
import { Spinner } from "../ProductCollections";
import { CheckboxInput, Selector, TextArea } from "../ProductFormControls";
import { Popover } from "../ProductOverlays";
import { VerticalResizeHandle } from "../VerticalResizeHandle";

export function CommitComposer({
  changelistMutation,
  changelists,
  closeCommitComposer,
  commit,
  commitDisabled,
  commitOptionCount,
  commitRailWidth,
  committing,
  createChangelist,
  deleteSelectedChangelist,
  draft,
  focusCommitMessage,
  onCommitRailWidthChange,
  onDraftChange,
  selectedChangelist,
  stagedFiles,
  toolWindow,
}: {
  readonly changelistMutation: "create" | "delete" | null;
  readonly changelists: readonly Changelist[];
  readonly closeCommitComposer: () => void;
  readonly commit: (push: boolean) => Promise<void>;
  readonly commitDisabled: boolean;
  readonly commitOptionCount: number;
  readonly commitRailWidth: number;
  readonly committing: boolean;
  readonly createChangelist: () => Promise<void>;
  readonly deleteSelectedChangelist: () => Promise<void>;
  readonly draft: CommitDraft;
  readonly focusCommitMessage: () => void;
  readonly onCommitRailWidthChange: (width: number) => void;
  readonly onDraftChange: (draft: CommitDraft) => void;
  readonly selectedChangelist: Changelist | null;
  readonly stagedFiles: readonly ChangeEntry["file"][];
  readonly toolWindow: boolean;
}) {
  const [commitOptionsOpen, setCommitOptionsOpen] = useState(false);
  useDismissLayer(
    useMemo(
      () => ({
        id: "commit-options",
        priority: 110,
        active: commitOptionsOpen,
        dismiss: () => setCommitOptionsOpen(false),
      }),
      [commitOptionsOpen],
    ),
  );

  return (
    <aside
      className={`commitRail commitRail [position:relative] [display:grid] [min-height:0] [min-width:0] [grid-template-rows:34px_auto_auto_minmax(110px,_1fr)_auto] [gap:7px] [padding:7px] [border-left:1px_solid_var(--border)] max-[1120px]:[position:absolute] max-[1120px]:[top:0] max-[1120px]:[right:0] max-[1120px]:[bottom:0] max-[1120px]:[z-index:var(--layer-responsive-panel)] max-[1120px]:[width:min(var(--commit-rail-width,_340px),_calc(100%_-_220px))] max-[1120px]:[transform:translateX(102%)] max-[1120px]:[box-shadow:var(--shadow-lg)] max-[1120px]:[transition:transform_120ms_ease-out] [&_textarea]:[min-height:110px] [&_textarea]:[resize:none] [&_textarea]:[padding:9px] [&_textarea]:[background:var(--secondary)] [&_textarea]:[border:1px_solid_var(--border)] [&>_.verticalResizeHandle]:[right:auto] [&>_.verticalResizeHandle]:[left:-4px] max-[1120px]:[&>_.verticalResizeHandle]:[display:none] [&>_footer]:[display:grid] [&>_footer]:[grid-template-columns:minmax(0,_1fr)_auto_auto] [&>_footer]:[align-items:center] [&>_footer]:[gap:5px] [&>_footer]:[padding-top:7px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer_>_button]:[min-height:29px] [&>_footer_>_button]:[padding:0_9px] [&>_footer_>_button]:[background:var(--secondary)] [&>_footer_>_button]:[border:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[align-items:center] [&>_header]:[gap:6px] [&>_header_small]:[margin-left:auto] [&>_header_small]:[color:var(--disabled-foreground)]`}
    >
      {!toolWindow && (
        <VerticalResizeHandle
          direction={-1}
          label="Resize commit composer"
          onChange={onCommitRailWidthChange}
          value={commitRailWidth}
        />
      )}
      <header>
        <strong>{toolWindow ? "Commit Message" : "Commit"}</strong>
        <small>{stagedFiles.length} staged</small>
        {!toolWindow && (
          <Button
            onClick={closeCommitComposer}
            type="button"
            aria-label={"Close commit composer"}
            className="[display:none]! aspect-square h-[26px] min-w-[26px] px-0 max-[1120px]:[display:inline-flex]!"
            variant="ghost"
            size="icon-sm"
          >
            <Icon name="close" size={13} />
          </Button>
        )}
      </header>
      <div
        className={`changelistBar changelistBar [display:flex] [min-width:0] [gap:5px] [padding-bottom:5px] [&_button]:[height:24px] [&_select]:[min-width:0] [&_select]:[flex:1] [&_select]:rounded-sm [&_select]:[padding:0_6px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)]`}
      >
        <Selector
          isLabelHidden
          label="Commit changelist"
          onChange={(value) =>
            onDraftChange({
              ...draft,
              changelistId: value || null,
            })
          }
          options={[
            { value: "", label: "Default · staged index" },
            ...changelists.map((changelist) => ({
              value: changelist.id,
              label: `${changelist.name} · ${changelist.paths.length} files`,
            })),
          ]}
          placement="above"
          size="sm"
          value={draft.changelistId ?? ""}
          width="100%"
        />
        <Button
          type="button"
          aria-busy={changelistMutation === "create"}
          disabled={changelistMutation !== null}
          onClick={() => void createChangelist()}
          className={cn("h-7 px-2.5")}
          variant="ghost"
          size="sm"
        >
          {changelistMutation === "create" ? (
            <Spinner label="Creating changelist…" size="sm" />
          ) : (
            "New"
          )}
        </Button>
      </div>
      {selectedChangelist && (
        <Button
          type="button"
          aria-busy={changelistMutation === "delete"}
          disabled={changelistMutation !== null}
          onClick={() => void deleteSelectedChangelist()}
          className={cn(
            "hover:bg-destructive-muted active:bg-destructive-muted/80 h-7 border-border bg-secondary px-2.5 shadow-xs hover:border-destructive",
            "w-full",
            "deleteChangelistButton [grid-row:3]",
          )}
          variant="destructive"
          size="sm"
        >
          {changelistMutation === "delete" ? (
            <Spinner label="Deleting changelist…" size="sm" />
          ) : (
            "Delete selected changelist"
          )}
        </Button>
      )}
      <TextArea
        fieldClassName={
          "commitMessageField [grid-row:4] h-full min-h-0 [&>span]:h-full [&>span]:min-h-0 [&_textarea]:h-full [&_textarea]:min-h-0"
        }
        data-commit-message
        isLabelHidden
        label="Commit message"
        onChange={(message) => onDraftChange({ ...draft, message })}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          closeCommitComposer();
        }}
        placeholder="Commit message"
        rows={7}
        size="sm"
        value={draft.message}
        width="100%"
      />
      <footer className="flex items-center justify-end gap-2 border-t border-border p-2">
        <Popover
          alignment="end"
          hasAutoFocus
          isOpen={commitOptionsOpen}
          label="Commit options"
          onOpenChange={setCommitOptionsOpen}
          placement="above"
          width={260}
          content={
            <div className="grid gap-1 p-1">
              <CheckboxInput
                label="Amend"
                onChange={(amend) => {
                  onDraftChange({ ...draft, amend });
                  focusCommitMessage();
                }}
                size="sm"
                value={draft.amend}
              />
              <CheckboxInput
                label="Sign-off"
                onChange={(signOff) => onDraftChange({ ...draft, signOff })}
                size="sm"
                value={draft.signOff}
              />
              <CheckboxInput
                label="GPG sign"
                onChange={(gpgSign) => onDraftChange({ ...draft, gpgSign })}
                size="sm"
                value={draft.gpgSign}
              />
              <CheckboxInput
                label="Run hooks"
                onChange={(runHooks) => onDraftChange({ ...draft, runHooks })}
                size="sm"
                value={draft.runHooks}
              />
              {!selectedChangelist && (
                <CheckboxInput
                  label="Commit tracked"
                  onChange={(commitAll) =>
                    onDraftChange({
                      ...draft,
                      commitAll,
                    })
                  }
                  size="sm"
                  value={draft.commitAll}
                />
              )}
            </div>
          }
        >
          <Button
            type="button"
            className={cn("h-7 px-2.5")}
            variant="ghost"
            size="sm"
          >
            Commit options
            {commitOptionCount > 0 ? <em>{commitOptionCount}</em> : undefined}
          </Button>
        </Popover>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={() => void commit(false)}
                type="button"
                aria-busy={committing}
                disabled={commitDisabled || committing}
                className={cn("h-7 px-2.5")}
                variant="outline"
                size="sm"
              >
                {committing ? "Checking…" : "Commit"}
              </Button>
            }
          />
          <TooltipContent>Commit · ⌘↩</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                onClick={() => void commit(true)}
                type="button"
                aria-busy={committing}
                disabled={commitDisabled || committing}
                className={cn("h-7 px-2.5")}
                variant="default"
                size="sm"
              >
                {committing ? "Checking…" : "Commit & Push"}
              </Button>
            }
          />
          <TooltipContent>Commit &amp; Push · ⇧⌘↩</TooltipContent>
        </Tooltip>
      </footer>
    </aside>
  );
}
