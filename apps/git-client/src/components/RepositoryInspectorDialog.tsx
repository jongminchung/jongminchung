import { Button } from "@jongminchung/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import { cn } from "@jongminchung/ui/lib/utils";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlameLine, Commit, TreeEntry } from "../domain/types";
import type { FileContent, FilePreview, FileSource } from "../shared/contracts/model";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { EmptyState, Spinner } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextInput } from "./ProductFormControls";

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
  readOnly = false,
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
  readonly readOnly?: boolean;
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
    !readOnly &&
    source.kind === "workingTree" &&
    content?.kind === "text" &&
    editorValue !== content.content;
  useDismissLayer(
    useMemo(
      () => ({
        id: "repository-inspector",
        priority: 120,
        active: !embedded,
        dismiss: onClose,
      }),
      [embedded, onClose],
    ),
  );

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setPath(initialPath ?? "");
  }, [initialPath]);

  useEffect(() => {
    onDirtyChangeRef.current?.(editorDirty);
  }, [editorDirty]);

  useEffect(() => () => onDirtyChangeRef.current?.(false), []);

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
        } else if (tab === "history" && path) setHistory(await loadFileHistory(path));
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
    path,
  ]);

  const saveEditor = useCallback(
    async (value: string): Promise<void> => {
      if (readOnly || source.kind !== "workingTree" || content?.kind !== "text" || saving) return;
      setSaving(true);
      setError(undefined);
      try {
        await writeWorkingTreeFile(path, value);
        const sizeBytes = new TextEncoder().encode(value).byteLength;
        const lineCount =
          value.length === 0
            ? 0
            : (value.match(/\n/gu)?.length ?? 0) + (value.endsWith("\n") ? 0 : 1);
        setContent({
          ...content,
          content: value,
          sizeBytes,
          lineCount,
        });
        setEditorValue(value);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setSaving(false);
      }
    },
    [content, path, readOnly, saving, source.kind, writeWorkingTreeFile],
  );

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

  const inspectorStatus = error ? (
    <EmptyState description={error} title="Unable to load Git data" />
  ) : loading ? (
    <div className="grid h-full place-items-center">
      <Spinner label="Loading Git data…" size="lg" />
    </div>
  ) : null;

  const surface = (
    <section
      aria-label={embedded ? `Editor: ${path || "Repository"}` : undefined}
      className={
        embedded
          ? `inspectorEmbedded [display:grid] [grid-template-rows:38px_minmax(0,_1fr)] [height:100%] [min-height:0] [overflow:hidden] [&>_nav]:[align-items:center] [&>_nav]:[border-bottom:1px_solid_var(--border)] inspectorEmbedded`
          : "grid h-[min(720px,calc(100vh-70px))] min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden"
      }
    >
      {!embedded && (
        <DialogHeader
          hasDivider
          onOpenChange={(isOpen) => !isOpen && onClose()}
          subtitle={
            source.kind === "workingTree"
              ? "Working Tree"
              : source.kind === "index"
                ? "Git Index"
                : revision.slice(0, 10)
          }
          title="Repository inspector"
        />
      )}
      <Tabs
        className="contents"
        onValueChange={(value) => {
          if (isInspectorTab(value)) setTab(value);
        }}
        value={tab}
      >
        <nav className="flex min-w-0 items-center gap-2 border-b border-border bg-muted px-3 py-1.5">
          <TabsList
            aria-label="Repository inspector views"
            className="inline-flex h-7 items-center rounded-md bg-muted p-0.5"
          >
            <TabsTrigger
              className="h-full rounded px-2.5 text-xs text-muted-foreground outline-none hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45"
              value="tree"
            >
              Tree
            </TabsTrigger>
            <TabsTrigger
              className="h-full rounded px-2.5 text-xs text-muted-foreground outline-none hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45"
              value="file"
            >
              File
            </TabsTrigger>
            <TabsTrigger
              className="h-full rounded px-2.5 text-xs text-muted-foreground outline-none hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45"
              value="history"
            >
              File History
            </TabsTrigger>
            <TabsTrigger
              className="h-full rounded px-2.5 text-xs text-muted-foreground outline-none hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-xs focus-visible:ring-2 focus-visible:ring-ring/45"
              value="blame"
            >
              Blame
            </TabsTrigger>
          </TabsList>
          {tab === "tree" ? (
            <>
              <Button
                onClick={() => setTreePath(treePath.split("/").slice(0, -1).join("/"))}
                type="button"
                disabled={!treePath}
                className={cn("h-7 px-2.5")}
                variant="ghost"
                size="sm"
              >
                Up
              </Button>
              <code className="min-w-0 flex-1 truncate text-muted-foreground">/{treePath}</code>
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
              <Button type="submit" className={cn("h-7 px-2.5")} variant="outline" size="sm">
                Load
              </Button>
            </form>
          )}
          {tab === "file" && source.kind === "workingTree" && content?.kind === "text" && (
            <Button
              onClick={() => void saveEditor(editorValue)}
              type="button"
              disabled={readOnly || saving || editorValue === content.content}
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </nav>
        <TabsContent
          aria-busy={loading}
          className={`inspectorContent [min-height:0] [overflow:auto] inspectorContent`}
          value="tree"
        >
          {inspectorStatus ?? (
            <div
              className={`inspectorTree [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[display:grid] [&>_button]:[gap:8px] [&>_button]:[grid-template-columns:18px_minmax(180px,_1fr)_70px_90px_70px] [&>_button]:[height:29px] [&>_button]:[padding:0_12px] [&>_button]:[text-align:left] [&>_button]:[width:100%] [&>_button:hover]:[background:var(--muted)] [&_small]:[color:var(--disabled-foreground)] [&_code]:[color:var(--disabled-foreground)] inspectorTree`}
            >
              {tree.map((entry) => (
                <Button
                  key={`${entry.kind}-${entry.path}`}
                  onDoubleClick={() => {
                    if (entry.kind === "tree") {
                      setTreePath([treePath, entry.path].filter(Boolean).join("/"));
                    } else {
                      setPath([treePath, entry.path].filter(Boolean).join("/"));
                      setTab("file");
                    }
                  }}
                  type="button"
                  className={cn(
                    "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                  )}
                  variant="ghost"
                  size="default"
                >
                  <Icon name={entry.kind === "tree" ? "folder" : "file"} size={14} />
                  <span>{entry.path}</span>
                  <small>{entry.mode}</small>
                  <small>
                    {entry.size === undefined ? "" : `${entry.size.toLocaleString()} B`}
                  </small>
                  <code>{entry.oid.slice(0, 8)}</code>
                </Button>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent
          aria-busy={loading}
          className={`inspectorContent [min-height:0] [overflow:auto] inspectorContent`}
          value="file"
        >
          {inspectorStatus ??
            (!content ? (
              <EmptyState title="Select a file to view its contents." />
            ) : content.kind === "text" ? (
              <Suspense
                fallback={
                  <Spinner className="h-full w-full justify-center" label="Loading viewer…" />
                }
              >
                <CodeMirrorFile
                  bookmarkedLines={bookmarkedLines}
                  editable={source.kind === "workingTree" && !readOnly}
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
              <figure
                className={`imageViewer [align-items:center] [display:flex] [flex-direction:column] [gap:12px] [height:100%] [justify-content:center] [margin:0] [overflow:auto] [padding:20px] [&_img]:[background:var(--muted)] [&_img]:[box-shadow:var(--shadow-xs)] [&_img]:[max-height:calc(100%_-_54px)] [&_img]:[max-width:100%] [&_img]:[object-fit:contain] [&_figcaption]:[align-items:center] [&_figcaption]:[color:var(--muted-foreground)] [&_figcaption]:[display:flex] [&_figcaption]:[gap:9px] [&_figcaption_strong]:[color:var(--foreground)] [&_button]:[background:var(--muted)] [&_button]:[border:1px_solid_var(--border)] [&_button]:rounded-sm [&_button]:[height:28px] [&_button]:[padding:0_9px] imageViewer [&_button]:rounded-sm`}
              >
                <img alt={preview.preview.path} src={preview.preview.dataUrl} />
                <figcaption>
                  <strong>{preview.preview.path}</strong>
                  <span>
                    {preview.preview.mimeType} · {preview.preview.sizeBytes.toLocaleString()} bytes
                  </span>
                  {source.kind === "workingTree" && (
                    <Button
                      disabled={readOnly}
                      onClick={() => void openWorkingTreeFile(preview.preview.path)}
                      type="button"
                      className={cn("h-7 px-2.5")}
                      variant="outline"
                      size="sm"
                    >
                      Open in default application
                    </Button>
                  )}
                </figcaption>
              </figure>
            ) : (
              <EmptyState
                description={
                  content.kind === "binary"
                    ? "Binary file"
                    : content.kind === "invalidUtf8"
                      ? "Not valid UTF-8"
                      : content.kind === "tooLarge"
                        ? "File exceeds the 5 MiB or 50,000 line viewer limit"
                        : "File does not exist at this source"
                }
                title={content.path}
              >
                {"sizeBytes" in content && (
                  <small>{content.sizeBytes.toLocaleString()} bytes</small>
                )}
                {source.kind === "workingTree" && content.kind !== "missing" && (
                  <Button
                    onClick={() => void openWorkingTreeFile(content.path)}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    Open in default application
                  </Button>
                )}
              </EmptyState>
            ))}
        </TabsContent>
        <TabsContent
          aria-busy={loading}
          className={`inspectorContent [min-height:0] [overflow:auto] inspectorContent`}
          value="history"
        >
          {inspectorStatus ?? (
            <div
              className={`historyList [&_article:hover]:[background:var(--muted)] [&_span]:[color:var(--disabled-foreground)] [&_time]:[color:var(--disabled-foreground)] [&_article]:[align-items:center] [&_article]:[border-bottom:1px_solid_var(--border)] [&_article]:[display:grid] [&_article]:[gap:10px] [&_article]:[grid-template-columns:75px_minmax(200px,_1fr)_130px_170px] [&_article]:[min-height:38px] [&_article]:[padding:0_12px] historyList`}
            >
              {history.map((commit) => (
                <article key={commit.oid}>
                  <code>{commit.oid.slice(0, 8)}</code>
                  <strong>{commit.subject}</strong>
                  <span>{commit.author}</span>
                  <time>{new Date(commit.authoredAt * 1000).toLocaleString()}</time>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent
          aria-busy={loading}
          className={`inspectorContent [min-height:0] [overflow:auto] inspectorContent`}
          value="blame"
        >
          {inspectorStatus ?? (
            <div
              className={`blameView [&>_div:hover]:[background:var(--muted)] [&>_div]:[display:grid] [&>_div]:[font-size:10px] [&>_div]:[grid-template-columns:50px_70px_120px_minmax(200px,_1fr)] [&>_div]:[min-height:22px] [&>_div_>_*]:[align-items:center] [&>_div_>_*]:[border-right:1px_solid_var(--border)] [&>_div_>_*]:[display:flex] [&>_div_>_*]:[margin:0] [&>_div_>_*]:[padding:2px_7px] [&_pre]:[font-family:var(--font-family-code)] [&_pre]:[overflow-x:auto] [&_pre]:[white-space:pre] blameView`}
            >
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
        </TabsContent>
      </Tabs>
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
