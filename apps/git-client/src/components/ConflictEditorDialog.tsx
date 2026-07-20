import { lazy, Suspense, useMemo, useState } from "react";
import { COMMAND_ENABLED, commandDefinition, type CommandDefinition } from "../domain/commands";
import { parseConflictBlocks, resolveConflictBlock } from "../domain/conflicts";
import type { ConflictContent, InProgressOperation } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { useCommandDefinitions, useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { Button } from "./ui";
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
        {onAccept && <Button label="Accept file" onClick={onAccept} size="sm" variant="ghost" />}
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
                  clickAction={onContinue}
                  label={`Continue ${operation}`}
                  size="sm"
                  variant="secondary"
                />
                <Button clickAction={onAbort} label="Abort" size="sm" variant="destructive" />
              </>
            )}
            <Button
              icon={<Icon name="close" size={15} />}
              isIconOnly
              label="Close conflict editor"
              onClick={() => void requestClose()}
              size="sm"
              variant="ghost"
            />
          </div>
          {content.binary ? (
            <div className={tw.binaryConflict}>
              <Icon name="warning" size={32} />
              <strong>Binary or oversized conflict</strong>
              <p>The file cannot be safely represented as UTF-8 text. Choose one complete side.</p>
              <div>
                <Button
                  clickAction={() => onResolveBinary("ours")}
                  label={`Use ${content.localLabel}`}
                  variant="secondary"
                />
                <Button
                  clickAction={() => onResolveBinary("theirs")}
                  label={`Use ${content.remoteLabel}`}
                  variant="secondary"
                />
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
                        label="Local"
                        onClick={() => resolveBlock("local")}
                        size="sm"
                        variant="ghost"
                      />
                      <Button
                        label="Remote"
                        onClick={() => resolveBlock("remote")}
                        size="sm"
                        variant="ghost"
                      />
                      <Button
                        label="Both"
                        onClick={() => resolveBlock("both")}
                        size="sm"
                        variant="ghost"
                      />
                    </>
                  )}
                  <Button
                    clickAction={() => onSave(result)}
                    label="Save and stage"
                    size="sm"
                    variant="primary"
                  />
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
