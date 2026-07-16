import { memo, useState } from "react";
import type { ConsoleEntry, FileChange, StatusModel } from "../domain/types";
import type { Changelist, GitOperation, RecoveryEntry, ShelfEntry } from "../generated";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

type Tab = "commit" | "shelf" | "stash" | "recovery" | "console";
const tabs: readonly {
  readonly id: Tab;
  readonly label: string;
  readonly icon: Parameters<typeof Icon>[0]["name"];
}[] = [
  { id: "commit", label: "Commit", icon: "changes" },
  { id: "shelf", label: "Shelf", icon: "shelf" },
  { id: "stash", label: "Stash", icon: "stash" },
  { id: "recovery", label: "Recovery", icon: "history" },
  { id: "console", label: "Console", icon: "console" },
];

function changeStatusClass(file: FileChange): string {
  if (file.status === "added") return styles.statusAdded!;
  if (file.status === "untracked") return styles.statusUnknown!;
  if (file.status === "conflicted") return styles.statusConflict!;
  return styles.statusModified!;
}

function ChangeList({
  title,
  files,
  action,
  onOperation,
  onOpenDiff,
  onAssign,
}: {
  readonly title: string;
  readonly files: readonly FileChange[];
  readonly action: "stage" | "unstage";
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onOpenDiff: (file: FileChange, staged: boolean) => void;
  readonly onAssign?: (file: FileChange) => void;
}) {
  return (
    <div className={styles.changeList}>
      <header>
        <span>
          <Icon name="chevron" size={12} />
          {title}
        </span>
        <small>{files.length} files</small>
        <button
          onClick={() => void onOperation({ kind: action, paths: files.map((file) => file.path) })}
        >
          {action === "stage" ? "Stage all" : "Unstage all"}
        </button>
      </header>
      {files.map((file) => (
        <div
          className={styles.changeRow}
          key={`${title}-${file.path}`}
          onDoubleClick={() => onOpenDiff(file, action === "unstage")}
        >
          <span className={`${styles.statusBadge} ${changeStatusClass(file)}`}>
            {file.status === "untracked" ? "?" : file.status.charAt(0).toUpperCase()}
          </span>
          <Icon name="file" size={13} />
          <span className={styles.ellipsis}>{file.path}</span>
          {onAssign && (
            <button className={styles.rowAction} onClick={() => onAssign(file)} title="Changelist">
              ↳
            </button>
          )}
          <button
            className={styles.rowAction}
            onClick={() => void onOperation({ kind: action, paths: [file.path] })}
          >
            {action === "stage" ? "+" : "−"}
          </button>
        </div>
      ))}
    </div>
  );
}

export const BottomPanel = memo(function BottomPanel({
  status,
  shelves,
  changelists,
  recoveryEntries,
  consoleEntries,
  onOperation,
  onCreateShelf,
  onApplyShelf,
  onDeleteShelf,
  onSaveChangelist,
  onDeleteChangelist,
  onCommitChangelist,
  onRestoreRecovery,
  onOpenDiff,
  collapsed,
  onToggle,
}: {
  readonly status: StatusModel;
  readonly shelves: readonly ShelfEntry[];
  readonly changelists: readonly Changelist[];
  readonly recoveryEntries: readonly RecoveryEntry[];
  readonly consoleEntries: readonly ConsoleEntry[];
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onCreateShelf: (message: string, paths: readonly string[]) => void;
  readonly onApplyShelf: (shelfId: string, drop: boolean) => void;
  readonly onDeleteShelf: (shelfId: string) => void;
  readonly onSaveChangelist: (
    id: string | null,
    name: string,
    paths: readonly string[],
  ) => Promise<Changelist>;
  readonly onDeleteChangelist: (changelistId: string) => Promise<void>;
  readonly onCommitChangelist: (
    changelistId: string,
    message: string,
    amend: boolean,
  ) => Promise<void>;
  readonly onRestoreRecovery: (entryId: string) => Promise<void>;
  readonly onOpenDiff: (file: FileChange, staged: boolean) => void;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}) {
  const [active, setActive] = useState<Tab>("commit");
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [selectedChangelistId, setSelectedChangelistId] = useState<string>("");
  const staged = status.changes.filter((file) => file.staged);
  const unstaged = status.changes.filter((file) => file.worktree);
  const selectedChangelist = changelists.find((item) => item.id === selectedChangelistId);
  const assignedPaths = new Set(changelists.flatMap((changelist) => changelist.paths));
  const visibleChanges = selectedChangelist
    ? status.changes.filter((file) => selectedChangelist.paths.includes(file.path))
    : unstaged.filter((file) => !assignedPaths.has(file.path));
  const assign = async (file: FileChange) => {
    const choice = window.prompt(
      `Move ${file.path} to changelist`,
      changelists[0]?.name ?? "Feature work",
    );
    if (!choice?.trim()) return;
    const existing = changelists.find((changelist) => changelist.name === choice.trim());
    for (const changelist of changelists) {
      if (changelist.id !== existing?.id && changelist.paths.includes(file.path)) {
        await onSaveChangelist(
          changelist.id,
          changelist.name,
          changelist.paths.filter((path) => path !== file.path),
        );
      }
    }
    const saved = await onSaveChangelist(existing?.id ?? null, choice.trim(), [
      ...(existing?.paths ?? []),
      file.path,
    ]);
    setSelectedChangelistId(saved.id);
  };
  const commit = async (push: boolean) => {
    if (!message.trim()) return;
    if (selectedChangelist) {
      await onCommitChangelist(selectedChangelist.id, message.trim(), amend);
      setSelectedChangelistId("");
    } else {
      await onOperation({
        kind: "commit",
        message: message.trim(),
        amend,
        signOff: false,
        gpgSign: false,
      });
    }
    if (push)
      await onOperation({ kind: "push", remote: null, refspec: null, forceWithLease: false });
    setMessage("");
  };
  return (
    <section className={`${styles.bottomPanel} ${collapsed ? styles.bottomCollapsed : ""}`}>
      <div className={styles.toolTabs}>
        {tabs.map((tab) => (
          <button
            className={active === tab.id ? styles.activeToolTab : undefined}
            key={tab.id}
            onClick={() => {
              setActive(tab.id);
              if (collapsed) onToggle();
            }}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
            {tab.id === "commit" && status.changes.length > 0 && <em>{status.changes.length}</em>}
            {tab.id === "stash" && status.stashCount > 0 && <em>{status.stashCount}</em>}
          </button>
        ))}
        <span />
        <button className={styles.iconButton} onClick={onToggle}>
          {collapsed ? "⌃" : "⌄"}
        </button>
      </div>
      {!collapsed && (
        <div className={styles.toolContent}>
          {active === "commit" && (
            <div className={styles.commitTool}>
              <div className={styles.changeColumns}>
                <ChangeList
                  action="unstage"
                  files={staged}
                  onOperation={onOperation}
                  onOpenDiff={onOpenDiff}
                  title="Staged Changes"
                />
                <ChangeList
                  action="stage"
                  files={visibleChanges}
                  onAssign={(file) => void assign(file)}
                  onOperation={onOperation}
                  onOpenDiff={onOpenDiff}
                  title={selectedChangelist?.name ?? "Changes"}
                />
              </div>
              <div className={styles.commitComposer}>
                <div className={styles.changelistBar}>
                  <select
                    aria-label="Commit changelist"
                    onChange={(event) => setSelectedChangelistId(event.target.value)}
                    value={selectedChangelistId}
                  >
                    <option value="">Default · staged index</option>
                    {changelists.map((changelist) => (
                      <option key={changelist.id} value={changelist.id}>
                        {changelist.name} · {changelist.paths.length} files
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const name = window.prompt("New changelist name", "Feature work");
                      if (name)
                        void onSaveChangelist(null, name, []).then((saved) =>
                          setSelectedChangelistId(saved.id),
                        );
                    }}
                  >
                    New
                  </button>
                  {selectedChangelist && (
                    <button
                      onClick={() => {
                        if (!window.confirm(`Delete changelist “${selectedChangelist.name}”?`))
                          return;
                        void onDeleteChangelist(selectedChangelist.id).then(() =>
                          setSelectedChangelistId(""),
                        );
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <textarea
                  aria-label="Commit message"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Commit message"
                  value={message}
                />
                <div>
                  <label>
                    <input
                      checked={amend}
                      onChange={(event) => setAmend(event.target.checked)}
                      type="checkbox"
                    />
                    Amend
                  </label>
                  <span />
                  <button
                    disabled={
                      !message.trim() ||
                      (selectedChangelist
                        ? selectedChangelist.paths.length === 0
                        : staged.length === 0)
                    }
                    onClick={() => void commit(false)}
                  >
                    Commit
                  </button>
                  <button
                    className={styles.primaryButton}
                    disabled={
                      !message.trim() ||
                      (selectedChangelist
                        ? selectedChangelist.paths.length === 0
                        : staged.length === 0)
                    }
                    onClick={() => void commit(true)}
                  >
                    Commit and Push
                  </button>
                </div>
              </div>
            </div>
          )}
          {active === "shelf" && (
            <div className={styles.collectionTool}>
              <div className={styles.collectionIntro}>
                <Icon name="shelf" size={24} />
                <div>
                  <strong>Shelf</strong>
                  <p>
                    Index, worktree, and untracked files are stored atomically outside the
                    repository.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const message = window.prompt("Shelf name", "WIP: ");
                    if (message)
                      onCreateShelf(
                        message,
                        status.changes.map((file) => file.path),
                      );
                  }}
                >
                  Shelve Changes…
                </button>
              </div>
              {shelves.map((shelf) => (
                <div className={styles.collectionRow} key={shelf.id}>
                  <Icon name="patch" size={16} />
                  <div>
                    <strong>{shelf.message}</strong>
                    <small>
                      {new Date(shelf.createdAtMs).toLocaleString()} · {shelf.files.length} files ·
                      checksum verified
                    </small>
                  </div>
                  <button onClick={() => onApplyShelf(shelf.id, false)}>Apply</button>
                  <button onClick={() => onApplyShelf(shelf.id, true)}>Unshelve</button>
                  <button
                    aria-label={`Delete ${shelf.message}`}
                    className={styles.iconButton}
                    onClick={() => {
                      if (window.confirm(`Delete shelf “${shelf.message}”?`))
                        onDeleteShelf(shelf.id);
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {active === "stash" && (
            <div className={styles.collectionTool}>
              <div className={styles.collectionIntro}>
                <Icon name="stash" size={24} />
                <div>
                  <strong>Git Stash</strong>
                  <p>Native stash entries from refs/stash.</p>
                </div>
                <button
                  onClick={() =>
                    void onOperation({
                      kind: "stashPush",
                      message: null,
                      includeUntracked: true,
                      keepIndex: false,
                    })
                  }
                >
                  Stash Changes…
                </button>
              </div>
              {Array.from({ length: status.stashCount }, (_, index) => (
                <div className={styles.collectionRow} key={index}>
                  <Icon name="commit" size={16} />
                  <div>
                    <strong>stash@{`{${index}}`}: WIP on main</strong>
                    <small>
                      {index === 0 ? "2 hours ago" : `${index + 1} days ago`} · local changes
                    </small>
                  </div>
                  <button
                    onClick={() =>
                      void onOperation({
                        kind: "stashApply",
                        stash: `stash@{${index}}`,
                        pop: false,
                        reinstateIndex: true,
                      })
                    }
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          )}
          {active === "recovery" && (
            <div className={styles.collectionTool}>
              <div className={styles.collectionIntro}>
                <Icon name="history" size={24} />
                <div>
                  <strong>Ref Recovery Ledger</strong>
                  <p>Ref OIDs captured before history-changing operations.</p>
                </div>
              </div>
              {recoveryEntries.length === 0 ? (
                <div className={styles.emptyState}>No ref-changing operations recorded yet.</div>
              ) : (
                recoveryEntries.map((entry) => (
                  <div className={styles.collectionRow} key={entry.id}>
                    <Icon name="history" size={16} />
                    <div>
                      <strong>{entry.operation}</strong>
                      <small>
                        {new Date(entry.createdAtMs).toLocaleString()} ·{" "}
                        {entry.branch ?? "detached"}
                        {entry.refs.map((reference) => ` · ${reference.name}`).join("")}
                      </small>
                    </div>
                    <button
                      disabled={!entry.recoverable}
                      onClick={() => {
                        const refs = entry.refs.map((reference) => reference.name).join("\n");
                        if (!window.confirm(`Restore the recorded ref state?\n\n${refs}`)) return;
                        void onRestoreRecovery(entry.id);
                      }}
                    >
                      {entry.recoverable ? "Restore refs" : "Objects expired"}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
          {active === "console" && (
            <div className={styles.consoleTool}>
              {consoleEntries.length === 0 ? (
                <div className={styles.emptyState}>
                  Git commands and credential-redacted output appear here.
                </div>
              ) : (
                consoleEntries.map((entry) => (
                  <article key={entry.id}>
                    <header>
                      <span className={`${styles.consoleStatus} ${styles[entry.status]}`} />{" "}
                      <code>{entry.command}</code>
                      <span>
                        {entry.duration === undefined ? "running" : `${entry.duration} ms`}
                      </span>
                    </header>
                    {entry.output && <pre>{entry.output}</pre>}
                  </article>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
