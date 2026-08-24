import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { toVoidHandler } from "../../domain/toVoidHandler";
import type { RecoveryEntry } from "../../shared/contracts/model/index";
import type { AppDialogController } from "../AppDialog";
import { Icon } from "../Icon";
import { EmptyState } from "../ProductCollections";

export function RecoverySurface({
  dialog,
  entries,
  onRestore,
}: {
  readonly dialog: AppDialogController;
  readonly entries: readonly RecoveryEntry[];
  readonly onRestore: (entryId: string) => Promise<void>;
}) {
  return (
    <div
      className={`collectionTool [&_button]:[background:var(--muted)] [&_button]:[border:1px_solid_var(--border)] [&_button]:rounded-sm [&_button]:[height:27px] [&_button]:[padding:0_9px] [&_button]:[white-space:nowrap] [height:100%] [overflow:auto] collectionTool [&_button]:rounded-sm`}
    >
      <div
        className={`collectionIntro [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:10px] [min-height:48px] [padding:8px_14px] [background:var(--muted)] [&_div]:[flex:1] [&_p]:[color:var(--muted-foreground)] [&_p]:[margin:2px_0_0] collectionIntro`}
      >
        <Icon name="history" size={24} />
        <div>
          <strong>Ref Recovery Ledger</strong>
          <p>Ref OIDs captured before history-changing operations.</p>
        </div>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No ref-changing operations recorded yet." />
      ) : (
        entries.map((entry) => (
          <div
            className={`collectionRow [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:10px] [min-height:48px] [padding:8px_14px] [&_div]:[flex:1] [&_small]:[color:var(--disabled-foreground)] [&_small]:[display:block] [&_small]:[margin-top:3px] [border-bottom:0] collectionRow`}
            key={entry.id}
          >
            <Icon name="history" size={16} />
            <div>
              <strong>{entry.operation}</strong>
              <small>
                {new Date(entry.createdAtMs).toLocaleString()} ·{" "}
                {entry.branch ?? "detached"}
                {entry.refs.map((reference) => ` · ${reference.name}`).join("")}
              </small>
            </div>
            <Button
              disabled={!entry.recoverable}
              onClick={toVoidHandler(async () => {
                const refs = entry.refs
                  .map((reference) => reference.name)
                  .join("\n");
                const accepted = await dialog.confirm({
                  title: "Restore the recorded ref state?",
                  description:
                    "Each ref is restored only if it still matches the expected post-operation value.",
                  impact: refs,
                  confirmLabel: "Restore refs",
                  dangerous: true,
                });
                if (!accepted) return;
                void onRestore(entry.id);
              })}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              {entry.recoverable ? "Restore refs" : "Objects expired"}
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
