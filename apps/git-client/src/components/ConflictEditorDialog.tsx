import { lazy, Suspense, useMemo, useState } from "react";
import { parseConflictBlocks, resolveConflictBlock } from "../domain/conflicts";
import type { ConflictContent, InProgressOperation } from "../generated";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

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
    <section className={styles.conflictPane}>
      <header>
        <strong>{label}</strong>
        {onAccept && <button onClick={onAccept}>Accept file</button>}
      </header>
      <div>
        <Suspense fallback={<div className={styles.emptyState}>Loading editor…</div>}>
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
  const blocks = useMemo(() => parseConflictBlocks(result), [result]);
  const selectedBlock = blocks[Math.min(blockIndex, Math.max(0, blocks.length - 1))];
  const resolveBlock = (choice: "local" | "remote" | "both") => {
    if (!selectedBlock) return;
    setResult(resolveConflictBlock(result, selectedBlock, choice));
    setBlockIndex(Math.min(blockIndex, Math.max(0, blocks.length - 2)));
  };
  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section className={styles.conflictDialog} role="dialog" aria-modal="true">
        <header>
          <Icon name="warning" size={16} />
          <strong>{content.path}</strong>
          <small>{blocks.length} unresolved blocks</small>
          <span />
          {operation && operation !== "bisect" && (
            <>
              <button onClick={() => void onContinue()}>Continue {operation}</button>
              <button onClick={() => void onAbort()}>Abort</button>
            </>
          )}
          <button
            className={styles.iconButton}
            aria-label="Close conflict editor"
            onClick={onClose}
          >
            <Icon name="close" size={15} />
          </button>
        </header>
        {content.binary ? (
          <div className={styles.binaryConflict}>
            <Icon name="warning" size={32} />
            <strong>Binary or oversized conflict</strong>
            <p>The file cannot be safely represented as UTF-8 text. Choose one complete side.</p>
            <div>
              <button onClick={() => void onResolveBinary("ours")}>Use {content.localLabel}</button>
              <button onClick={() => void onResolveBinary("theirs")}>
                Use {content.remoteLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.conflictGrid}>
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
            <section className={styles.conflictPane}>
              <header>
                <strong>Result</strong>
                {blocks.length > 0 && (
                  <>
                    <select
                      aria-label="Conflict block"
                      value={Math.min(blockIndex, blocks.length - 1)}
                      onChange={(event) => setBlockIndex(Number(event.target.value))}
                    >
                      {blocks.map((block) => (
                        <option key={`${block.start}-${block.end}`} value={block.index}>
                          Block {block.index + 1}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => resolveBlock("local")}>Local</button>
                    <button onClick={() => resolveBlock("remote")}>Remote</button>
                    <button onClick={() => resolveBlock("both")}>Both</button>
                  </>
                )}
                <button className={styles.primaryButton} onClick={() => void onSave(result)}>
                  Save and stage
                </button>
              </header>
              <div>
                <Suspense fallback={<div className={styles.emptyState}>Loading editor…</div>}>
                  <CodeMirrorText onChange={setResult} readOnly={false} value={result} />
                </Suspense>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
