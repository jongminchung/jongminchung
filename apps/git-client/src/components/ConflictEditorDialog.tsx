import { Button } from "@jongminchung/ui/components/button";
import { Spinner as SpinnerIcon } from "@jongminchung/ui/components/spinner";
import { cn } from "@jongminchung/ui/lib/utils";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  COMMAND_ENABLED,
  commandDefinition,
  type CommandDefinition,
} from "../domain/commands";
import { parseConflictBlocks, resolveConflictBlock } from "../domain/conflicts";
import { sanitizeGitError } from "../domain/gitActivity";
import {
  abortOperationConfirmation,
  operationDisplayName,
} from "../domain/recoveryFlow";
import type {
  ConflictContent,
  InProgressOperation,
} from "../shared/contracts/model/index";
import { useAppDialog } from "./AppDialog";
import { useCommandDefinitions, useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { Spinner } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { Selector } from "./ProductFormControls";

const CodeMirrorText = lazy(() => import("./CodeMirrorText"));

type PendingAction = "continue" | "abort" | "ours" | "theirs" | "save";

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
    <section
      className={`conflictPane [&_select]:[background:var(--muted)] [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-sm [&_select]:[min-height:26px] [&_select]:[padding:0_8px] [display:grid] [grid-template-rows:32px_minmax(0,_1fr)] [min-height:0] [min-width:0] [&:nth-child(odd)]:[border-right:1px_solid_var(--border)] [&:nth-child(-n_+_2)]:[border-bottom:1px_solid_var(--border)] [&>_header]:[align-items:center] [&>_header]:[background:var(--muted)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:4px] [&>_header]:[padding:2px_7px] [&>_header_strong]:[flex:1] [&>_div]:[min-height:0] [&>_div]:[overflow:hidden] conflictPane [&_select]:rounded-sm`}
    >
      <header>
        <strong>{label}</strong>
        {onAccept && (
          <Button
            onClick={onAccept}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="ghost"
            size="sm"
          >
            Accept file
          </Button>
        )}
      </header>
      <div>
        <Suspense
          fallback={
            <Spinner
              className="h-full w-full justify-center"
              label="Loading editor…"
            />
          }
        >
          <CodeMirrorText
            readOnly
            value={value ?? "File does not exist on this side."}
          />
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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (operation && operation !== "bisect") continueButtonRef.current?.focus();
  }, [operation]);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, node: confirmationNode } = useAppDialog();
  const blocks = useMemo(() => parseConflictBlocks(result), [result]);
  const selectedBlock =
    blocks[Math.min(blockIndex, Math.max(0, blocks.length - 1))];
  const resolveBlock = (choice: "local" | "remote" | "both"): void => {
    if (!selectedBlock) return;
    setResult(resolveConflictBlock(result, selectedBlock, choice));
    setBlockIndex(Math.min(blockIndex, Math.max(0, blocks.length - 2)));
  };
  const runAction = useCallback(
    async (
      action: PendingAction,
      operationAction: () => Promise<void>,
    ): Promise<void> => {
      if (pendingAction !== null) return;
      setPendingAction(action);
      setActionError(null);
      try {
        await operationAction();
      } catch (reason) {
        setActionError(sanitizeGitError(reason));
      } finally {
        setPendingAction(null);
      }
    },
    [pendingAction],
  );
  const requestClose = useCallback(async (): Promise<void> => {
    if (pendingAction !== null) return;
    if (result !== (content.result ?? "")) {
      const accepted = await confirm({
        title: "Discard conflict result edits?",
        description:
          "The repository is unchanged, but edits made in the conflict result pane will be lost.",
        confirmLabel: "Discard result",
        dangerous: true,
      });
      if (!accepted) return;
    }
    onClose();
  }, [confirm, content.result, onClose, pendingAction, result]);
  const requestAbort = useCallback(async (): Promise<void> => {
    if (!operation || operation === "bisect" || pendingAction !== null) return;
    const accepted = await confirm(
      abortOperationConfirmation(operation, result !== (content.result ?? "")),
    );
    if (accepted) await runAction("abort", onAbort);
  }, [
    confirm,
    content.result,
    onAbort,
    operation,
    pendingAction,
    result,
    runAction,
  ]);
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
          () => runAction("save", () => onSave(result)),
          () => COMMAND_ENABLED,
        ),
        allowInEditor: true,
        allowInCodeEditor: true,
        label: "Save and Stage Conflict Result",
        priority: 100,
      },
    ],
    [onSave, result, runAction],
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
        <section className="relative grid h-[min(760px,calc(100vh-50px))] min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
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
                  aria-busy={pendingAction === "continue"}
                  disabled={pendingAction !== null}
                  ref={continueButtonRef}
                  type="button"
                  onClick={() => {
                    void runAction("continue", onContinue);
                  }}
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  {pendingAction === "continue" ? (
                    <SpinnerIcon aria-hidden className="size-3.5" />
                  ) : null}
                  {`Continue ${operationDisplayName(operation)}`}
                </Button>
                <Button
                  aria-busy={pendingAction === "abort"}
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => {
                    void requestAbort();
                  }}
                  className={cn("h-7 px-2.5")}
                  variant="destructive"
                  size="sm"
                >
                  {pendingAction === "abort" ? (
                    <SpinnerIcon aria-hidden className="size-3.5" />
                  ) : null}
                  Abort
                </Button>
              </>
            )}
            <Button
              onClick={() => void requestClose()}
              type="button"
              aria-label={"Close conflict editor"}
              aria-keyshortcuts="Escape"
              disabled={pendingAction !== null}
              className={cn("h-7 px-2.5 aspect-square px-0")}
              variant="ghost"
              size="icon-sm"
            >
              <Icon name="close" size={15} />
            </Button>
          </div>
          {actionError && (
            <Notice
              className="absolute top-12 right-2 left-2 z-20 shadow-lg"
              role="alert"
              tone="destructive"
            >
              {actionError}
            </Notice>
          )}
          {content.binary ? (
            <div
              className={`binaryConflict [align-items:center] [display:flex] [flex-direction:column] [justify-content:center] [padding:40px] [text-align:center] [&_p]:[color:var(--muted-foreground)] [&_p]:[max-width:480px] [&>_div]:[display:flex] [&>_div]:[gap:8px] binaryConflict`}
            >
              <Icon name="warning" size={32} />
              <strong>Binary or oversized conflict</strong>
              <p>
                The file cannot be safely represented as UTF-8 text. Choose one
                complete side.
              </p>
              <div>
                <Button
                  aria-busy={pendingAction === "ours"}
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => {
                    void runAction("ours", () => onResolveBinary("ours"));
                  }}
                  className={cn("h-8 px-3")}
                  variant="outline"
                  size="default"
                >
                  {pendingAction === "ours" ? (
                    <SpinnerIcon aria-hidden className="size-3.5" />
                  ) : null}
                  {`Use ${content.localLabel}`}
                </Button>
                <Button
                  aria-busy={pendingAction === "theirs"}
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => {
                    void runAction("theirs", () => onResolveBinary("theirs"));
                  }}
                  className={cn("h-8 px-3")}
                  variant="outline"
                  size="default"
                >
                  {pendingAction === "theirs" ? (
                    <SpinnerIcon aria-hidden className="size-3.5" />
                  ) : null}
                  {`Use ${content.remoteLabel}`}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`conflictGrid [display:grid] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [grid-template-rows:repeat(2,_minmax(0,_1fr))] [min-height:0] conflictGrid`}
            >
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
              <section
                className={`conflictPane [&_select]:[background:var(--muted)] [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-sm [&_select]:[min-height:26px] [&_select]:[padding:0_8px] [display:grid] [grid-template-rows:32px_minmax(0,_1fr)] [min-height:0] [min-width:0] [&:nth-child(odd)]:[border-right:1px_solid_var(--border)] [&:nth-child(-n_+_2)]:[border-bottom:1px_solid_var(--border)] [&>_header]:[align-items:center] [&>_header]:[background:var(--muted)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:4px] [&>_header]:[padding:2px_7px] [&>_header_strong]:[flex:1] [&>_div]:[min-height:0] [&>_div]:[overflow:hidden] conflictPane [&_select]:rounded-sm`}
              >
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
                        onClick={() => resolveBlock("local")}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="ghost"
                        size="sm"
                      >
                        Local
                      </Button>
                      <Button
                        onClick={() => resolveBlock("remote")}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="ghost"
                        size="sm"
                      >
                        Remote
                      </Button>
                      <Button
                        onClick={() => resolveBlock("both")}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="ghost"
                        size="sm"
                      >
                        Both
                      </Button>
                    </>
                  )}
                  <Button
                    aria-busy={pendingAction === "save"}
                    disabled={pendingAction !== null}
                    type="button"
                    onClick={() => {
                      void runAction("save", () => onSave(result));
                    }}
                    className={cn("h-7 px-2.5")}
                    variant="default"
                    size="sm"
                  >
                    {pendingAction === "save" ? (
                      <SpinnerIcon aria-hidden className="size-3.5" />
                    ) : null}
                    Save and stage
                  </Button>
                </header>
                <div>
                  <Suspense
                    fallback={
                      <Spinner
                        className="h-full w-full justify-center"
                        label="Loading editor…"
                      />
                    }
                  >
                    <CodeMirrorText
                      onChange={setResult}
                      readOnly={false}
                      value={result}
                    />
                  </Suspense>
                </div>
              </section>
            </div>
          )}
        </section>
      </Dialog>
      {confirmationNode}
    </>
  );
}
