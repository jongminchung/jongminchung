import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { TextInput } from "@astryxdesign/core/TextInput";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlameLine, Commit, TreeEntry } from "../domain/types";
import type { FileContent, FilePreview, FileSource } from "../generated";
import { Icon } from "./Icon";
import { tw } from "../styles/tailwind";
import { useDismissLayer } from "./CommandProvider";

const CodeMirrorFile = lazy(() => import("./CodeMirrorFile"));

export type InspectorTab = "tree" | "file" | "history" | "blame";

function isInspectorTab(value: string): value is InspectorTab {
  return value === "tree" || value === "file" || value === "history" || value === "blame";
}

export function RepositoryInspectorDialog({
  revision,
  initialPath,
  initialTab,
  onClose,
  loadTree,
  loadFileHistory,
  loadBlame,
  readFile,
  readFilePreview,
  writeWorkingTreeFile,
  onDirtyChange,
  openWorkingTreeFile,
  source,
  embedded = false,
  initialLine,
  initialColumn,
  bookmarkedLines,
  onToggleBookmark,
}: {
  readonly revision: string;
  readonly initialPath?: string;
  readonly initialTab: InspectorTab;
  readonly onClose: () => void;
  readonly loadTree: (revision: string, path?: string) => Promise<readonly TreeEntry[]>;
  readonly loadFileHistory: (path: string) => Promise<readonly Commit[]>;
  readonly loadBlame: (path: string, revision?: string) => Promise<readonly BlameLine[]>;
  readonly readFile: (source: FileSource, path: string) => Promise<FileContent>;
  readonly readFilePreview: (source: FileSource, path: string) => Promise<FilePreview>;
  readonly writeWorkingTreeFile: (path: string, content: string) => Promise<void>;
  readonly onDirtyChange?: (dirty: boolean) => void;
  readonly openWorkingTreeFile: (path: string) => Promise<void>;
  readonly source: FileSource;
  readonly embedded?: boolean;
  readonly initialLine?: number;
  readonly initialColumn?: number;
  readonly bookmarkedLines?: readonly number[];
  readonly onToggleBookmark?: (path: string, line: number, column: number) => void;
}) {
  const [tab, setTab] = useState<InspectorTab>(initialTab);
  const [path, setPath] = useState(initialPath ?? "");
  const [treePath, setTreePath] = useState("");
  const [tree, setTree] = useState<readonly TreeEntry[]>([]);
  const [history, setHistory] = useState<readonly Commit[]>([]);
  const [blame, setBlame] = useState<readonly BlameLine[]>([]);
  const [content, setContent] = useState<FileContent>();
  const [preview, setPreview] = useState<FilePreview>();
  const [editorValue, setEditorValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadToken, setReloadToken] = useState(0);
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const editorDirty =
    source.kind === "workingTree" &&
    content?.kind === "text" &&
    editorValue !== content.content;
  useDismissLayer(useMemo(() => ({
    id: "repository-inspector",
    priority: 120,
    active: !embedded,
    dismiss: onClose,
  }), [embedded, onClose]));

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setPath(initialPath ?? "");
  }, [initialPath]);

  useEffect(() => {
    onDirtyChangeRef.current?.(editorDirty);
  }, [editorDirty]);

  useEffect(
    () => () => onDirtyChangeRef.current?.(false),
    [],
  );

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);
      try {
        if (tab === "tree") setTree(await loadTree(revision, treePath || undefined));
        else if (tab === "file" && path) {
          setPreview(undefined);
          const nextContent = await readFile(source, path);
          setContent(nextContent);
          if (nextContent.kind === "text") setEditorValue(nextContent.content);
          if (nextContent.kind === "binary") {
            setPreview(await readFilePreview(source, path));
          }
        }
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
    readFilePreview,
    reloadToken,
    revision,
    source,
    tab,
    treePath,
  ]);

  const saveEditor = useCallback(async (value: string): Promise<void> => {
    if (source.kind !== "workingTree" || content?.kind !== "text" || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await writeWorkingTreeFile(path, value);
      const sizeBytes = new TextEncoder().encode(value).byteLength;
      const lineCount = value.length === 0
        ? 0
        : (value.match(/\n/gu)?.length ?? 0) + (value.endsWith("\n") ? 0 : 1);
      setContent({ ...content, content: value, sizeBytes, lineCount });
      setEditorValue(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }, [content, path, saving, source.kind, writeWorkingTreeFile]);

  useEffect(() => {
    const saveAll = (event: Event): void => {
      if (!editorDirty) return;
      const task = saveEditor(editorValue);
      if (event instanceof CustomEvent && Array.isArray(event.detail?.tasks)) {
        event.detail.tasks.push(task);
      } else {
        void task;
      }
    };
    const reload = (): void => setReloadToken((value) => value + 1);
    window.addEventListener("git-client:save-all", saveAll);
    window.addEventListener("git-client:reload-editors", reload);
    return () => {
      window.removeEventListener("git-client:save-all", saveAll);
      window.removeEventListener("git-client:reload-editors", reload);
    };
  }, [editorDirty, editorValue, saveEditor]);

  const surface = (
      <section
        aria-label={embedded ? `Editor: ${path || "Repository"}` : undefined}
        className={embedded ? tw.inspectorEmbedded : "grid h-[min(720px,calc(100vh-70px))] min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden"}
      >
        {!embedded && (
          <DialogHeader
            hasDivider
            onOpenChange={(isOpen) => !isOpen && onClose()}
            subtitle={source.kind === "workingTree" ? "Working Tree" : source.kind === "index" ? "Git Index" : revision.slice(0, 10)}
            title="Repository inspector"
          />
        )}
        <nav className="flex min-w-0 items-center gap-2 border-b border-border bg-muted px-3 py-1.5">
          <TabList
            aria-label="Repository inspector views"
            onChange={(value) => {
              if (isInspectorTab(value)) setTab(value);
            }}
            size="sm"
            value={tab}
          >
            <Tab label="Tree" value="tree" />
            <Tab label="File" value="file" />
            <Tab label="File History" value="history" />
            <Tab label="Blame" value="blame" />
          </TabList>
          {tab === "tree" ? (
            <>
              <Button
                isDisabled={!treePath}
                label="Up"
                onClick={() => setTreePath(treePath.split("/").slice(0, -1).join("/"))}
                size="sm"
                variant="ghost"
              />
              <code className="min-w-0 flex-1 truncate text-secondary">/{treePath}</code>
            </>
          ) : (
            <form
              className="ml-2 grid min-w-48 flex-1 grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setReloadToken((value) => value + 1);
              }}
            >
              <TextInput
                isLabelHidden
                label="Repository file path"
                onChange={setPath}
                placeholder="src/path/to/file.ts"
                size="sm"
                value={path}
                width="100%"
              />
              <Button label="Load" size="sm" type="submit" variant="secondary" />
            </form>
          )}
          {tab === "file" && source.kind === "workingTree" && content?.kind === "text" && (
            <Button
              isDisabled={saving || editorValue === content.content}
              label={saving ? "Saving…" : "Save"}
              onClick={() => void saveEditor(editorValue)}
              size="sm"
              variant="secondary"
            />
          )}
        </nav>
        <div className={tw.inspectorContent} aria-busy={loading}>
          {error ? (
            <EmptyState description={error} title="Unable to load Git data" />
          ) : loading ? (
            <div className="grid h-full place-items-center"><Spinner label="Loading Git data…" size="lg" /></div>
          ) : tab === "tree" ? (
            <div className={tw.inspectorTree}>
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
              <div className={tw.emptyState}>Select a file to view its contents.</div>
            ) : content.kind === "text" ? (
              <Suspense fallback={<div className={tw.emptyState}>Loading viewer…</div>}>
                <CodeMirrorFile
                  bookmarkedLines={bookmarkedLines}
                  editable={source.kind === "workingTree"}
                  initialColumn={initialColumn}
                  initialLine={initialLine}
                  onChange={setEditorValue}
                  onSave={saveEditor}
                  onToggleBookmark={(line, column) =>
                    onToggleBookmark?.(content.path, line, column)
                  }
                  path={content.path}
                  value={content.content}
                />
              </Suspense>
            ) : preview?.kind === "image" ? (
              <figure className={tw.imageViewer}>
                <img alt={preview.preview.path} src={preview.preview.dataUrl} />
                <figcaption>
                  <strong>{preview.preview.path}</strong>
                  <span>{preview.preview.mimeType} · {preview.preview.sizeBytes.toLocaleString()} bytes</span>
                  {source.kind === "workingTree" && (
                    <button onClick={() => void openWorkingTreeFile(preview.preview.path)}>
                      Open in default application
                    </button>
                  )}
                </figcaption>
              </figure>
            ) : (
              <div className={tw.emptyState}>
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
            <div className={tw.historyList}>
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
            <div className={tw.blameView}>
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
  );

  if (embedded) return surface;

  return (
    <Dialog
      aria-label="Repository inspector"
      isOpen
      maxHeight="90vh"
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      padding={0}
      purpose="info"
      width="min(1080px, calc(100vw - 70px))"
    >
      {surface}
    </Dialog>
  );
}
