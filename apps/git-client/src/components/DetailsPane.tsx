import { memo, useState } from "react";
import type { Commit, FileChange } from "../domain/types";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

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
  if (status === "added") return styles.statusAdded!;
  if (status === "deleted") return styles.statusDeleted!;
  if (status === "renamed" || status === "copied") return styles.statusRenamed!;
  if (status === "conflicted") return styles.statusConflict!;
  if (status === "untracked") return styles.statusUnknown!;
  return styles.statusModified!;
}

export const DetailsPane = memo(function DetailsPane({
  commit,
  files,
  loading,
  onOpenDiff,
  onOpenTree,
  onInspectFile,
}: {
  readonly commit?: Commit;
  readonly files: readonly FileChange[];
  readonly loading: boolean;
  readonly onOpenDiff: (file: FileChange) => void;
  readonly onOpenTree: () => void;
  readonly onInspectFile: (file: FileChange, view: "history" | "blame") => void;
}) {
  const [treeMode, setTreeMode] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string>();
  const selectedFile = files.find((file) => file.path === selectedPath);
  return (
    <aside className={styles.detailsPane} aria-label="Commit details">
      <div className={styles.detailsToolbar}>
        <button className={styles.iconButton} title="Previous commit">
          <span>↑</span>
        </button>
        <button className={styles.iconButton} title="Next commit">
          <span>↓</span>
        </button>
        <span className={styles.toolbarDivider} />
        <button className={styles.iconButton} onClick={onOpenTree} title="Repository at revision">
          <Icon name="external" size={14} />
        </button>
        <button
          className={styles.iconButton}
          disabled={!selectedFile}
          onClick={() => selectedFile && onInspectFile(selectedFile, "history")}
          title="File history"
        >
          <Icon name="history" size={14} />
        </button>
        <button
          className={styles.iconButton}
          disabled={!selectedFile}
          onClick={() => selectedFile && onInspectFile(selectedFile, "blame")}
          title="Blame"
        >
          <Icon name="changes" size={14} />
        </button>
        <span className={styles.toolbarDivider} />
        <button
          className={`${styles.iconButton} ${treeMode ? styles.activeButton : ""}`}
          onClick={() => setTreeMode(true)}
          title="Tree"
        >
          <Icon name="folder" size={14} />
        </button>
        <button
          className={`${styles.iconButton} ${!treeMode ? styles.activeButton : ""}`}
          onClick={() => setTreeMode(false)}
          title="Flat list"
        >
          <Icon name="changes" size={14} />
        </button>
        <span className={styles.filterSpacer} />
        <span className={styles.fileCount}>{files.length} files</span>
      </div>
      <div className={styles.fileTree}>
        {loading ? (
          <div className={styles.emptyState}>Loading commit files…</div>
        ) : !commit ? (
          <div className={styles.emptyState}>Select a commit to inspect its files.</div>
        ) : (
          files.map((file) => {
            const folders = file.path.split("/");
            const filename = folders.pop();
            return (
              <button
                className={styles.fileRow}
                key={file.path}
                onClick={() => setSelectedPath(file.path)}
                onDoubleClick={() => onOpenDiff(file)}
                title="Double-click to open diff"
              >
                <span className={`${styles.statusBadge} ${statusClass(file.status)}`}>
                  {statusLetter(file.status)}
                </span>
                <Icon name="file" size={14} />
                <span className={styles.ellipsis}>
                  {treeMode && folders.length ? <small>{folders.join("/")}/</small> : null}
                  {filename}
                </span>
                <span className={styles.diffStat}>
                  <i>+{file.additions ?? 0}</i>
                  <b>−{file.deletions ?? 0}</b>
                </span>
              </button>
            );
          })
        )}
      </div>
      {commit && (
        <div className={styles.commitDetails}>
          <h2>{commit.subject}</h2>
          <p>{commit.body}</p>
          <dl>
            <div>
              <dt>Author</dt>
              <dd>
                {commit.author} <a>{commit.email}</a>
              </dd>
            </div>
            <div>
              <dt>Commit</dt>
              <dd>
                <code>{commit.oid}</code>
              </dd>
            </div>
            <div>
              <dt>Parents</dt>
              <dd>
                {commit.parents.map((parent) => (
                  <code key={parent}>{parent.slice(0, 8)}</code>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </aside>
  );
});
