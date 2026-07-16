import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { assembleHunkPatch, assembleSelectedLinePatch, parseDiffDocument } from "../domain/parsers";
import type { FileChange } from "../domain/types";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

const CodeMirrorDiff = lazy(() => import("./CodeMirrorDiff"));

export function DiffDialog({
  file,
  patch,
  loading,
  mode,
  onApplyPatch,
  onClose,
}: {
  readonly file: FileChange;
  readonly patch: string;
  readonly loading: boolean;
  readonly mode: "readOnly" | "stage" | "unstage";
  readonly onApplyPatch?: (patch: string, cached: boolean, reverse: boolean) => Promise<void>;
  readonly onClose: () => void;
}) {
  const [sideBySide, setSideBySide] = useState(true);
  const [hunkIndex, setHunkIndex] = useState(0);
  const [selectedLines, setSelectedLines] = useState<ReadonlySet<number>>(new Set());
  const document = useMemo(() => parseDiffDocument(patch), [patch]);
  const hunk = document.hunks[hunkIndex];
  useEffect(() => setSelectedLines(new Set()), [hunkIndex, patch]);
  const unsupportedReason = file.binary
    ? "Binary file"
    : file.utf8 === false
      ? "Not valid UTF-8"
      : (file.sizeBytes ?? 0) > 5 * 1024 * 1024
        ? "File exceeds 5 MiB"
        : (file.lineCount ?? 0) > 50_000
          ? "File exceeds 50,000 lines"
          : undefined;
  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section
        aria-label={`Diff for ${file.path}`}
        aria-modal="true"
        className={styles.diffDialog}
        role="dialog"
      >
        <header>
          <div>
            <span className={`${styles.statusBadge} ${styles.statusModified}`}>M</span>
            <strong>{file.path}</strong>
            <small>
              {mode === "stage" ? "Working tree" : mode === "unstage" ? "Index" : "Revision"}
            </small>
          </div>
          <span />
          <button
            className={`${styles.iconButton} ${sideBySide ? styles.activeButton : ""}`}
            onClick={() => setSideBySide(!sideBySide)}
            title="Toggle side-by-side"
          >
            <Icon name="split" size={14} />
          </button>
          <button aria-label="Close diff" className={styles.iconButton} onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </header>
        <div className={styles.diffActions}>
          {mode !== "readOnly" && (
            <>
              <select
                aria-label="Selected hunk"
                onChange={(event) => setHunkIndex(Number(event.target.value))}
                value={hunkIndex}
              >
                {document.hunks.map((item, index) => (
                  <option key={`${item.header}-${index}`} value={index}>
                    Hunk {index + 1} · {item.header}
                  </option>
                ))}
              </select>
              <button
                disabled={!hunk || !onApplyPatch}
                onClick={() => {
                  if (!hunk || !onApplyPatch) return;
                  void onApplyPatch(
                    assembleHunkPatch(document.fileHeader, [hunk]),
                    true,
                    mode === "unstage",
                  );
                }}
              >
                {mode === "stage" ? "Stage hunk" : "Unstage hunk"}
              </button>
              <button
                disabled={!hunk || selectedLines.size === 0 || !onApplyPatch}
                onClick={() => {
                  if (!hunk || !onApplyPatch) return;
                  void onApplyPatch(
                    assembleSelectedLinePatch(document.fileHeader, hunk, selectedLines),
                    true,
                    mode === "unstage",
                  );
                }}
              >
                {mode === "stage" ? "Stage selected lines" : "Unstage selected lines"}
              </button>
              {mode === "stage" && (
                <button
                  disabled={!hunk || !onApplyPatch}
                  onClick={() => {
                    if (!hunk || !onApplyPatch) return;
                    if (!window.confirm("Discard this hunk from the working tree?")) return;
                    void onApplyPatch(assembleHunkPatch(document.fileHeader, [hunk]), false, true);
                  }}
                >
                  Revert hunk
                </button>
              )}
            </>
          )}
          <span />
          <small>Text · UTF-8 · {patch.split("\n").length} lines</small>
        </div>
        <div className={styles.diffEditor}>
          {loading ? (
            <div className={styles.emptyState}>Loading diff…</div>
          ) : unsupportedReason ? (
            <div className={styles.unsupportedDiff}>
              <Icon name="warning" size={24} />
              <strong>{unsupportedReason}</strong>
              <p>This file is shown as metadata only to keep the renderer responsive and safe.</p>
              <button>
                <Icon name="external" size={14} />
                Open externally
              </button>
            </div>
          ) : sideBySide ? (
            <Suspense
              fallback={<div className={styles.emptyState}>Loading lightweight diff editor…</div>}
            >
              <CodeMirrorDiff patch={patch} />
            </Suspense>
          ) : mode === "readOnly" || !hunk ? (
            <pre>{patch}</pre>
          ) : (
            <div className={styles.selectableDiff}>
              <code>{hunk.header}</code>
              {hunk.lines.map((line, index) => {
                const change = line.startsWith("+") || line.startsWith("-");
                return (
                  <button
                    className={
                      line.startsWith("+")
                        ? styles.addedDiffLine
                        : line.startsWith("-")
                          ? styles.deletedDiffLine
                          : undefined
                    }
                    disabled={!change}
                    key={`${index}-${line}`}
                    onClick={() =>
                      setSelectedLines((current) => {
                        const next = new Set(current);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })
                    }
                  >
                    <span>{change ? (selectedLines.has(index) ? "●" : "○") : ""}</span>
                    <code>{line || " "}</code>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
