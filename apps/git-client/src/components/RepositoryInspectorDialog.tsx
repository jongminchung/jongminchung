import { useEffect, useState } from "react";
import type { BlameLine, Commit, TreeEntry } from "../domain/types";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

export type InspectorTab = "tree" | "history" | "blame";

export function RepositoryInspectorDialog({
  revision,
  initialPath,
  initialTab,
  onClose,
  loadTree,
  loadFileHistory,
  loadBlame,
}: {
  readonly revision: string;
  readonly initialPath?: string;
  readonly initialTab: InspectorTab;
  readonly onClose: () => void;
  readonly loadTree: (revision: string, path?: string) => Promise<readonly TreeEntry[]>;
  readonly loadFileHistory: (path: string) => Promise<readonly Commit[]>;
  readonly loadBlame: (path: string, revision?: string) => Promise<readonly BlameLine[]>;
}) {
  const [tab, setTab] = useState<InspectorTab>(initialTab);
  const [path, setPath] = useState(initialPath ?? "");
  const [treePath, setTreePath] = useState("");
  const [tree, setTree] = useState<readonly TreeEntry[]>([]);
  const [history, setHistory] = useState<readonly Commit[]>([]);
  const [blame, setBlame] = useState<readonly BlameLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const reload = (activeTab = tab) => {
    let active = true;
    setLoading(true);
    setError(undefined);
    const task =
      activeTab === "tree"
        ? loadTree(revision, treePath || undefined).then((value) => {
            if (active) setTree(value);
          })
        : activeTab === "history"
          ? path
            ? loadFileHistory(path).then((value) => {
                if (active) setHistory(value);
              })
            : Promise.resolve()
          : path
            ? loadBlame(path, revision).then((value) => {
                if (active) setBlame(value);
              })
            : Promise.resolve();
    void task
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  };

  useEffect(() => reload(tab), [tab, treePath]);

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section className={styles.inspectorDialog} role="dialog" aria-modal="true">
        <header>
          <Icon name="folder" size={16} />
          <strong>Repository at {revision.slice(0, 10)}</strong>
          <span />
          <button className={styles.iconButton} aria-label="Close inspector" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </header>
        <nav>
          {(["tree", "history", "blame"] as const).map((item) => (
            <button
              className={tab === item ? styles.activeButton : undefined}
              key={item}
              onClick={() => setTab(item)}
            >
              {item === "tree" ? "Tree" : item === "history" ? "File History" : "Blame"}
            </button>
          ))}
          {tab === "tree" ? (
            <>
              <button
                disabled={!treePath}
                onClick={() => setTreePath(treePath.split("/").slice(0, -1).join("/"))}
              >
                ↑ Up
              </button>
              <code>/{treePath}</code>
            </>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                reload(tab);
              }}
            >
              <input
                aria-label="Repository file path"
                onChange={(event) => setPath(event.target.value)}
                placeholder="src/path/to/file.ts"
                value={path}
              />
              <button type="submit">Load</button>
            </form>
          )}
        </nav>
        <div className={styles.inspectorContent} aria-busy={loading}>
          {error ? (
            <div className={styles.emptyState}>{error}</div>
          ) : loading ? (
            <div className={styles.emptyState}>Loading Git data…</div>
          ) : tab === "tree" ? (
            <div className={styles.inspectorTree}>
              {tree.map((entry) => (
                <button
                  key={`${entry.kind}-${entry.path}`}
                  onDoubleClick={() => {
                    if (entry.kind === "tree") {
                      setTreePath([treePath, entry.path].filter(Boolean).join("/"));
                    } else {
                      setPath([treePath, entry.path].filter(Boolean).join("/"));
                      setTab("blame");
                    }
                  }}
                >
                  <Icon name={entry.kind === "tree" ? "folder" : "file"} size={14} />
                  <span>{entry.path}</span>
                  <small>{entry.mode}</small>
                  <small>
                    {entry.size === undefined ? "" : `${entry.size.toLocaleString()} B`}
                  </small>
                  <code>{entry.oid.slice(0, 8)}</code>
                </button>
              ))}
            </div>
          ) : tab === "history" ? (
            <div className={styles.historyList}>
              {history.map((commit) => (
                <article key={commit.oid}>
                  <code>{commit.oid.slice(0, 8)}</code>
                  <strong>{commit.subject}</strong>
                  <span>{commit.author}</span>
                  <time>{new Date(commit.authoredAt * 1000).toLocaleString()}</time>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.blameView}>
              {blame.map((line) => (
                <div
                  key={`${line.finalLine}-${line.oid}`}
                  title={`${line.summary} · ${line.email}`}
                >
                  <code>{line.finalLine}</code>
                  <code>{line.oid.slice(0, 8)}</code>
                  <span>{line.author}</span>
                  <pre>{line.content || " "}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
