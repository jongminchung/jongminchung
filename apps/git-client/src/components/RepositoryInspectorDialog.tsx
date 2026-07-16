import { lazy, Suspense, useEffect, useState } from "react";
import type { BlameLine, Commit, TreeEntry } from "../domain/types";
import type { FileContent, FileSource } from "../generated";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

const CodeMirrorFile = lazy(() => import("./CodeMirrorFile"));

export type InspectorTab = "tree" | "file" | "history" | "blame";

export function RepositoryInspectorDialog({
  revision,
  initialPath,
  initialTab,
  onClose,
  loadTree,
  loadFileHistory,
  loadBlame,
  readFile,
  openWorkingTreeFile,
  source,
}: {
  readonly revision: string;
  readonly initialPath?: string;
  readonly initialTab: InspectorTab;
  readonly onClose: () => void;
  readonly loadTree: (revision: string, path?: string) => Promise<readonly TreeEntry[]>;
  readonly loadFileHistory: (path: string) => Promise<readonly Commit[]>;
  readonly loadBlame: (path: string, revision?: string) => Promise<readonly BlameLine[]>;
  readonly readFile: (source: FileSource, path: string) => Promise<FileContent>;
  readonly openWorkingTreeFile: (path: string) => Promise<void>;
  readonly source: FileSource;
}) {
  const [tab, setTab] = useState<InspectorTab>(initialTab);
  const [path, setPath] = useState(initialPath ?? "");
  const [treePath, setTreePath] = useState("");
  const [tree, setTree] = useState<readonly TreeEntry[]>([]);
  const [history, setHistory] = useState<readonly Commit[]>([]);
  const [blame, setBlame] = useState<readonly BlameLine[]>([]);
  const [content, setContent] = useState<FileContent>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        if (tab === "tree") setTree(await loadTree(revision, treePath || undefined));
        else if (tab === "file" && path) setContent(await readFile(source, path));
        else if (tab === "history" && path) setHistory(await loadFileHistory(path));
        else if (path) {
          setBlame(await loadBlame(path, source.kind === "workingTree" ? undefined : revision));
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
  }, [
    loadBlame,
    loadFileHistory,
    loadTree,
    readFile,
    reloadToken,
    revision,
    source,
    tab,
    treePath,
  ]);

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section className={styles.inspectorDialog} role="dialog" aria-modal="true">
        <header>
          <Icon name="folder" size={16} />
          <strong>
            {source.kind === "workingTree"
              ? "Working Tree"
              : source.kind === "index"
                ? "Git Index"
                : `Repository at ${revision.slice(0, 10)}`}
          </strong>
          <span />
          <button className={styles.iconButton} aria-label="Close inspector" onClick={onClose}>
            <Icon name="close" size={15} />
          </button>
        </header>
        <nav>
          {(["tree", "file", "history", "blame"] as const).map((item) => (
            <button
              className={tab === item ? styles.activeButton : undefined}
              key={item}
              onClick={() => setTab(item)}
            >
              {item === "tree"
                ? "Tree"
                : item === "file"
                  ? "File"
                  : item === "history"
                    ? "File History"
                    : "Blame"}
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
                setReloadToken((value) => value + 1);
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
                      setTab("file");
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
          ) : tab === "file" ? (
            !content ? (
              <div className={styles.emptyState}>Select a file to view its contents.</div>
            ) : content.kind === "text" ? (
              <Suspense fallback={<div className={styles.emptyState}>Loading viewer…</div>}>
                <CodeMirrorFile path={content.path} value={content.content} />
              </Suspense>
            ) : (
              <div className={styles.emptyState}>
                <strong>{content.path}</strong>
                <span>
                  {content.kind === "binary"
                    ? "Binary file"
                    : content.kind === "invalidUtf8"
                      ? "Not valid UTF-8"
                      : content.kind === "tooLarge"
                        ? "File exceeds the 5 MiB or 50,000 line viewer limit"
                        : "File does not exist at this source"}
                </span>
                {"sizeBytes" in content && (
                  <small>{content.sizeBytes.toLocaleString()} bytes</small>
                )}
                {source.kind === "workingTree" && content.kind !== "missing" && (
                  <button onClick={() => void openWorkingTreeFile(content.path)}>
                    Open in default application
                  </button>
                )}
              </div>
            )
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
