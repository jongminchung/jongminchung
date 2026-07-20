import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DiffPreferences } from "../domain/changeReview";
import type { Commit, FileChange } from "../domain/types";
import type {
  CommitSignature,
  FileContent,
  FilePreview,
  FileSource,
  SubmoduleDiff,
} from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";
import { DiffViewer } from "./DiffViewer";
import { Icon } from "./Icon";
import { CheckboxInput } from "./ui";
import { Popover } from "./ui";
import { VerticalResizeHandle } from "./VerticalResizeHandle";

function statusLetter(status: FileChange["status"]): string {
  return {
    added: "A",
    modified: "M",
    deleted: "D",
    renamed: "R",
    copied: "C",
    untracked: "?",
    conflicted: "!",
  }[status];
}

function statusClass(status: FileChange["status"]): string {
  if (status === "added") return tw.statusAdded;
  if (status === "deleted") return tw.statusDeleted;
  if (status === "renamed" || status === "copied") return tw.statusRenamed;
  if (status === "conflicted") return tw.statusConflict;
  if (status === "untracked") return tw.statusUnknown;
  return tw.statusModified;
}

function ReviewAllRow({
  commit,
  file,
  loadDiff,
  readFile,
  parentRevision,
  preferences,
  onPreferencesChange,
}: {
  readonly commit: Commit;
  readonly file: FileChange;
  readonly loadDiff: (commit: Commit, file: FileChange) => Promise<string>;
  readonly readFile: (source: FileSource, path: string) => Promise<FileContent>;
  readonly parentRevision: string;
  readonly preferences: DiffPreferences;
  readonly onPreferencesChange: (preferences: DiffPreferences) => void;
}) {
  const [patch, setPatch] = useState("");
  const [content, setContent] = useState<{
    readonly before: FileContent | null;
    readonly after: FileContent | null;
  }>({ before: null, after: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const [nextPatch, before, after] = await Promise.all([
          loadDiff(commit, file),
          readFile({ kind: "revision", revision: parentRevision }, file.oldPath ?? file.path),
          readFile({ kind: "revision", revision: commit.oid }, file.path),
        ]);
        if (active) {
          setPatch(nextPatch);
          setContent({ before, after });
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [commit, file, loadDiff, parentRevision, readFile]);

  return (
    <article className={tw.reviewAllRow}>
      <header>
        <span className={`${tw.statusBadge} ${statusClass(file.status)}`}>
          {statusLetter(file.status)}
        </span>
        <strong>{file.path}</strong>
        <span />
        <small>
          +{file.additions ?? 0} −{file.deletions ?? 0}
        </small>
      </header>
      {loading ? (
        <div className={tw.emptyState}>Loading diff…</div>
      ) : error ? (
        <div className={tw.emptyState}>{error}</div>
      ) : (
        <DiffViewer
          afterContent={content.after}
          beforeContent={content.before}
          file={file}
          loading={false}
          mode="readOnly"
          onPreferencesChange={onPreferencesChange}
          patch={patch}
          preferences={preferences}
          sourceLabel={`${parentRevision.slice(0, 8)} → ${commit.oid.slice(0, 8)}`}
        />
      )}
    </article>
  );
}

function ReviewAll({
  commit,
  files,
  loadDiff,
  readFile,
  parentRevision,
  preferences,
  onPreferencesChange,
}: {
  readonly commit: Commit;
  readonly files: readonly FileChange[];
  readonly loadDiff: (commit: Commit, file: FileChange) => Promise<string>;
  readonly readFile: (source: FileSource, path: string) => Promise<FileContent>;
  readonly parentRevision: string;
  readonly preferences: DiffPreferences;
  readonly onPreferencesChange: (preferences: DiffPreferences) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parent.current,
    estimateSize: () => 360,
    overscan: 1,
  });
  return (
    <div className={tw.reviewAll} ref={parent}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => {
          const file = files[item.index];
          if (!file) return null;
          return (
            <div
              data-index={item.index}
              key={file.path}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                transform: `translateY(${item.start}px)`,
                width: "100%",
              }}
            >
              <ReviewAllRow
                commit={commit}
                file={file}
                loadDiff={loadDiff}
                onPreferencesChange={onPreferencesChange}
                parentRevision={parentRevision}
                preferences={preferences}
                readFile={readFile}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const DetailsPane = memo(function DetailsPane({
  commit,
  files,
  loading,
  signature,
  beforePreview,
  afterPreview,
  beforeContent,
  afterContent,
  submoduleDiff,
  selectedPath,
  patch,
  diffLoading,
  preferences,
  parentRevision,
  onParentRevisionChange,
  onPreferencesChange,
  onSelectFile,
  onLoadDiff,
  onReadFile,
  onOpenTree,
  onInspectFile,
  onPrevious,
  onNext,
  reviewWidth,
  onReviewWidthChange,
  onRevertSelectedChanges,
}: {
  readonly commit?: Commit;
  readonly files: readonly FileChange[];
  readonly loading: boolean;
  readonly signature?: CommitSignature;
  readonly beforePreview: FilePreview | null;
  readonly afterPreview: FilePreview | null;
  readonly beforeContent: FileContent | null;
  readonly afterContent: FileContent | null;
  readonly submoduleDiff: SubmoduleDiff | null;
  readonly selectedPath: string | null;
  readonly patch: string;
  readonly diffLoading: boolean;
  readonly preferences: DiffPreferences;
  readonly parentRevision: string | null;
  readonly onParentRevisionChange: (revision: string) => void;
  readonly onPreferencesChange: (preferences: DiffPreferences) => void;
  readonly onSelectFile: (file: FileChange) => void;
  readonly onLoadDiff: (commit: Commit, file: FileChange) => Promise<string>;
  readonly onReadFile: (source: FileSource, path: string) => Promise<FileContent>;
  readonly onOpenTree: () => void;
  readonly onInspectFile: (file: FileChange, view: "file" | "history" | "blame") => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly reviewWidth: number;
  readonly onReviewWidthChange: (width: number) => void;
  readonly onRevertSelectedChanges: () => Promise<void>;
}) {
  const [reviewAll, setReviewAll] = useState(false);
  const [focused, setFocused] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;
  const selectedIndex = selectedFile ? files.indexOf(selectedFile) : -1;
  const moveFile = (offset: number): void => {
    if (files.length === 0) return;
    const nextIndex = Math.min(files.length - 1, Math.max(0, selectedIndex + offset));
    const next = files[nextIndex];
    if (next) onSelectFile(next);
  };

  useEffect(() => setReviewAll(false), [commit?.oid]);
  useDismissLayer(
    useMemo(
      () => ({
        id: "history-focused-diff",
        priority: 70,
        active: focused,
        dismiss: () => setFocused(false),
      }),
      [focused],
    ),
  );

  return (
    <aside
      className={tw.detailsPane}
      aria-label="Revision review"
      style={{ "--history-review-width": `${reviewWidth}px` } as CSSProperties}
    >
      <VerticalResizeHandle
        direction={-1}
        label="Resize revision review"
        onChange={onReviewWidthChange}
        value={reviewWidth}
      />
      <div className={tw.detailsToolbar}>
        <button
          aria-label="Show Diff"
          className={tw.iconButton}
          disabled={!selectedFile}
          onClick={() => setFocused(true)}
          title="Show Diff"
        >
          <Icon name="compare" size={14} />
        </button>
        <button
          aria-label="Revert Selected Changes"
          className={tw.iconButton}
          disabled={!selectedFile || !patch || diffLoading}
          onClick={() => void onRevertSelectedChanges()}
          title="Revert Selected Changes"
        >
          <Icon name="undo" size={14} />
        </button>
        <Popover
          alignment="end"
          hasAutoFocus
          isOpen={optionsOpen}
          label="View Options"
          onOpenChange={setOptionsOpen}
          placement="below"
          width={250}
          content={
            <div className={tw.detailsViewOptions}>
              <CheckboxInput
                isDisabled={!commit || files.length === 0}
                label="Show All Changes"
                onChange={setReviewAll}
                size="sm"
                value={reviewAll}
              />
              <CheckboxInput
                label="Word Wrap"
                onChange={(wordWrap) => onPreferencesChange({ ...preferences, wordWrap })}
                size="sm"
                value={preferences.wordWrap}
              />
            </div>
          }
        >
          <button
            aria-label="View Options"
            className={reviewAll ? tw.activeButton : tw.iconButton}
            title="View Options"
          >
            <Icon name="more" size={14} />
          </button>
        </Popover>
        <span className={tw.filterSpacer} />
        <button aria-label="Expand All" className={tw.iconButton} disabled title="Expand All">
          <Icon name="plus" size={13} />
        </button>
        <button aria-label="Collapse All" className={tw.iconButton} disabled title="Collapse All">
          <Icon name="minus" size={13} />
        </button>
      </div>
      {!commit ? (
        <div className={tw.detailsEmpty}>
          <div>Select commit to view changes</div>
          <div>Commit details</div>
        </div>
      ) : reviewAll ? (
        <ReviewAll
          commit={commit}
          files={files}
          loadDiff={onLoadDiff}
          onPreferencesChange={onPreferencesChange}
          parentRevision={parentRevision ?? "4b825dc642cb6eb9a060e54bf8d69288fbee4904"}
          preferences={preferences}
          readFile={onReadFile}
        />
      ) : (
        <div className={tw.revisionSummary}>
          <nav aria-label="Changed files" className={tw.revisionFileList}>
            {loading ? (
              <div className={tw.emptyState}>Loading files…</div>
            ) : files.length === 0 ? (
              <div className={tw.emptyState}>This commit has no file changes.</div>
            ) : (
              files.map((file) => (
                <button
                  aria-current={selectedPath === file.path ? "true" : undefined}
                  className={selectedPath === file.path ? tw.selected : undefined}
                  key={file.path}
                  onClick={() => onSelectFile(file)}
                  onDoubleClick={() => {
                    onSelectFile(file);
                    setFocused(true);
                  }}
                >
                  <span className={`${tw.statusBadge} ${statusClass(file.status)}`}>
                    {statusLetter(file.status)}
                  </span>
                  <span className={`${tw.ellipsis} grid`} title={file.path}>
                    <strong className="truncate">{file.path.split("/").at(-1)}</strong>
                    {file.path.includes("/") && (
                      <small className="truncate">
                        {file.path.slice(0, file.path.lastIndexOf("/"))}
                      </small>
                    )}
                  </span>
                  <small>
                    +{file.additions ?? 0} −{file.deletions ?? 0}
                  </small>
                </button>
              ))
            )}
          </nav>
          <section className={tw.revisionCommitDetails}>
            <header>
              <strong>Commit details</strong>
              <button onClick={onPrevious} title="Previous commit">
                ↑
              </button>
              <button onClick={onNext} title="Next commit">
                ↓
              </button>
            </header>
            <strong>{commit.subject}</strong>
            <span>{commit.author}</span>
            <small>{commit.email}</small>
            <code>{commit.oid}</code>
            {commit.parents.length > 0 && (
              <select
                aria-label="Compare commit parent"
                onChange={(event) => onParentRevisionChange(event.target.value)}
                value={parentRevision ?? commit.parents[0]}
              >
                {commit.parents.map((parent, index) => (
                  <option key={parent} value={parent}>
                    Parent {index + 1} · {parent.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
            {signature && (
              <span
                className={
                  signature.status === "G"
                    ? tw.signatureGood
                    : signature.status === "N"
                      ? tw.muted
                      : tw.signatureBad
                }
              >
                {signature.status === "G"
                  ? "Verified signature"
                  : signature.status === "N"
                    ? "Unsigned"
                    : `Signature ${signature.status}`}
              </span>
            )}
            <footer>
              <button onClick={onOpenTree}>Browse Repository</button>
              {selectedFile && (
                <button onClick={() => onInspectFile(selectedFile, "file")}>View File</button>
              )}
            </footer>
          </section>
          {focused && selectedFile && (
            <DiffViewer
              afterContent={afterContent}
              afterPreview={afterPreview}
              beforeContent={beforeContent}
              beforePreview={beforePreview}
              submoduleDiff={submoduleDiff}
              file={selectedFile}
              focused
              loading={diffLoading}
              mode="readOnly"
              onNextFile={
                selectedIndex >= 0 && selectedIndex < files.length - 1
                  ? () => moveFile(1)
                  : undefined
              }
              onPreferencesChange={onPreferencesChange}
              onPreviousFile={selectedIndex > 0 ? () => moveFile(-1) : undefined}
              onToggleFocus={() => setFocused(false)}
              patch={patch}
              preferences={preferences}
              sourceLabel={
                parentRevision
                  ? `${parentRevision.slice(0, 8)} → ${commit.oid.slice(0, 8)}`
                  : "Revision"
              }
            />
          )}
        </div>
      )}
    </aside>
  );
});
