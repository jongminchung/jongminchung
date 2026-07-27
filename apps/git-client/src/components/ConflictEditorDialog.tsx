import { Button } from "@base-ui/react/button";
import { LoaderCircle } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { COMMAND_ENABLED, commandDefinition, type CommandDefinition } from "../domain/commands";
import { parseConflictBlocks, resolveConflictBlock } from "../domain/conflicts";
import { cn } from "../lib/utils";
import type { ConflictContent, InProgressOperation } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { useCommandDefinitions, useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { Selector } from "./ui";

const CodeMirrorText = lazy(() => import("./CodeMirrorText"));

function TextPane({
  label,
  value,
  onAccept,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly onAccept?: () => void;
}) {
  return (
    <section className={tw.conflictPane}>
      <header>
        <strong>{label}</strong>
        {onAccept && (
          <Button
            data-slot="button"
            onClick={onAccept}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
            )}
          >
            Accept file
          </Button>
        )}
      </header>
      <div>
        <Suspense fallback={<div className={tw.emptyState}>Loading editor…</div>}>
          <CodeMirrorText readOnly value={value ?? "File does not exist on this side."} />
        </Suspense>
      </div>
    </section>
  );
}

export function ConflictEditorDialog({
  content,
  operation,
  onClose,
  onSave,
  onResolveBinary,
  onContinue,
  onAbort,
}: {
  readonly content: ConflictContent;
  readonly operation: InProgressOperation | null;
  readonly onClose: () => void;
  readonly onSave: (result: string) => Promise<void>;
  readonly onResolveBinary: (side: "ours" | "theirs") => Promise<void>;
  readonly onContinue: () => Promise<void>;
  readonly onAbort: () => Promise<void>;
}) {
  const [result, setResult] = useState(content.result ?? "");
  const [blockIndex, setBlockIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    "continue" | "abort" | "ours" | "theirs" | "save" | null
  >(null);
  const dialog = useAppDialog();
  const blocks = useMemo(() => parseConflictBlocks(result), [result]);
  const selectedBlock = blocks[Math.min(blockIndex, Math.max(0, blocks.length - 1))];
  const resolveBlock = (choice: "local" | "remote" | "both") => {
    if (!selectedBlock) return;
    setResult(resolveConflictBlock(result, selectedBlock, choice));
    setBlockIndex(Math.min(blockIndex, Math.max(0, blocks.length - 2)));
  };
  const requestClose = async (): Promise<void> => {
    if (result !== (content.result ?? "")) {
      const accepted = await dialog.confirm({
        title: "Discard conflict result edits?",
        description:
          "The repository is unchanged, but edits made in the conflict result pane will be lost.",
        confirmLabel: "Discard result",
        dangerous: true,
      });
      if (!accepted) return;
    }
    onClose();
  };
  useDismissLayer(
    useMemo(
      () => ({
        id: "conflict-editor",
        priority: 125,
        active: true,
        dismiss: requestClose,
      }),
      [requestClose],
    ),
  );
  const commands = useMemo<readonly CommandDefinition[]>(
    () => [
      {
        ...commandDefinition(
          "changes.save",
          () => onSave(result),
          () => COMMAND_ENABLED,
        ),
        allowInEditor: true,
        allowInCodeEditor: true,
        label: "Save and Stage Conflict Result",
        priority: 100,
      },
    ],
    [onSave, result],
  );
  useCommandDefinitions(commands);
  return (
    <>
      <Dialog
        aria-label={`Resolve conflict in ${content.path}`}
        isOpen
        maxHeight="calc(100vh - 50px)"
        onOpenChange={(isOpen) => {
          if (!isOpen) void requestClose();
        }}
        padding={0}
        purpose="form"
        width="min(1440px, calc(100vw - 50px))"
      >
        <section className="grid h-[min(760px,calc(100vh-50px))] min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <div className="flex min-w-0 items-center gap-2 border-b border-border pr-3">
            <div className="min-w-0 flex-1">
              <DialogHeader
                hasDivider={false}
                subtitle={`${blocks.length} unresolved blocks`}
                title={content.path}
              />
            </div>
            {operation && operation !== "bisect" && (
              <>
                <Button
                  data-slot="button"
                  aria-busy={pendingAction === "continue"}
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => {
                    setPendingAction("continue");
                    void onContinue().finally(() => setPendingAction(null));
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
                  )}
                >
                  {pendingAction === "continue" ? (
                    <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                  ) : null}
                  {`Continue ${operation}`}
                </Button>
                <Button
                  data-slot="button"
                  aria-busy={pendingAction === "abort"}
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => {
                    setPendingAction("abort");
                    void onAbort().finally(() => setPendingAction(null));
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
                  )}
                >
                  {pendingAction === "abort" ? (
                    <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                  ) : null}
                  Abort
                </Button>
              </>
            )}
            <Button
              data-slot="button"
              onClick={() => void requestClose()}
              type="button"
              aria-label={"Close conflict editor"}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 aspect-square px-0 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
              )}
            >
              <Icon name="close" size={15} />
            </Button>
          </div>
          {content.binary ? (
            <div className={tw.binaryConflict}>
              <Icon name="warning" size={32} />
              <strong>Binary or oversized conflict</strong>
              <p>The file cannot be safely represented as UTF-8 text. Choose one complete side.</p>
              <div>
                <Button
                  data-slot="button"
                  aria-busy={pendingAction === "ours"}
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => {
                    setPendingAction("ours");
                    void onResolveBinary("ours").finally(() => setPendingAction(null));
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
                  )}
                >
                  {pendingAction === "ours" ? (
                    <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                  ) : null}
                  {`Use ${content.localLabel}`}
                </Button>
                <Button
                  data-slot="button"
                  aria-busy={pendingAction === "theirs"}
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => {
                    setPendingAction("theirs");
                    void onResolveBinary("theirs").finally(() => setPendingAction(null));
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
                  )}
                >
                  {pendingAction === "theirs" ? (
                    <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                  ) : null}
                  {`Use ${content.remoteLabel}`}
                </Button>
              </div>
            </div>
          ) : (
            <div className={tw.conflictGrid}>
              <TextPane
                label="Base"
                value={content.base}
                onAccept={() => setResult(content.base ?? "")}
              />
              <TextPane
                label={content.localLabel}
                value={content.local}
                onAccept={() => setResult(content.local ?? "")}
              />
              <TextPane
                label={content.remoteLabel}
                value={content.remote}
                onAccept={() => setResult(content.remote ?? "")}
              />
              <section className={tw.conflictPane}>
                <header>
                  <strong>Result</strong>
                  {blocks.length > 0 && (
                    <>
                      <Selector
                        aria-label="Conflict block"
                        isLabelHidden
                        label="Conflict block"
                        onChange={(value) => {
                          const nextBlock = Number(value);
                          if (
                            Number.isInteger(nextBlock) &&
                            nextBlock >= 0 &&
                            nextBlock < blocks.length
                          ) {
                            setBlockIndex(nextBlock);
                          }
                        }}
                        options={blocks.map((block) => ({
                          label: `Block ${block.index + 1}`,
                          value: String(block.index),
                        }))}
                        size="sm"
                        value={String(Math.min(blockIndex, blocks.length - 1))}
                      />
                      <Button
                        data-slot="button"
                        onClick={() => resolveBlock("local")}
                        type="button"
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                        )}
                      >
                        Local
                      </Button>
                      <Button
                        data-slot="button"
                        onClick={() => resolveBlock("remote")}
                        type="button"
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                        )}
                      >
                        Remote
                      </Button>
                      <Button
                        data-slot="button"
                        onClick={() => resolveBlock("both")}
                        type="button"
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground active:bg-[var(--overlay-pressed)]",
                        )}
                      >
                        Both
                      </Button>
                    </>
                  )}
                  <Button
                    data-slot="button"
                    aria-busy={pendingAction === "save"}
                    disabled={pendingAction !== null}
                    type="button"
                    onClick={() => {
                      setPendingAction("save");
                      void onSave(result).finally(() => setPendingAction(null));
                    }}
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 px-2.5 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
                    )}
                  >
                    {pendingAction === "save" ? (
                      <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                    ) : null}
                    Save and stage
                  </Button>
                </header>
                <div>
                  <Suspense fallback={<div className={tw.emptyState}>Loading editor…</div>}>
                    <CodeMirrorText onChange={setResult} readOnly={false} value={result} />
                  </Suspense>
                </div>
              </section>
            </div>
          )}
        </section>
      </Dialog>
      {dialog.node}
    </>
  );
}
