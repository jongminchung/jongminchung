import { Button } from "@jongminchung/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import type { GitConsoleEntry } from "../domain/gitConsole";
import type { ProjectSearchResult } from "../domain/projectSearch";
import { toVoidHandler } from "../domain/toVoidHandler";
import type { FileChange, StashEntry, StatusModel } from "../domain/types";
import {
  DEFAULT_BOTTOM_PANEL_HEIGHT,
  MAX_BOTTOM_PANEL_HEIGHT,
  MIN_BOTTOM_PANEL_HEIGHT,
  type WorkspaceBottomPanelTab,
} from "../domain/workspacePersistence";
import type {
  GitLocalHistoryActivitiesPage,
  GitLocalHistoryActivity,
  GitLocalHistoryActivityDetail,
  GitLocalHistoryScope,
} from "../shared/contracts/git-utility";
import type { GitOperation, RecoveryEntry, ShelfEntry } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { FindResultsPanel, type FindResultsSession } from "./FindResultsPanel";
import { GitConsolePanel } from "./GitConsolePanel";
import { Icon } from "./Icon";
import { LocalHistoryPanel } from "./LocalHistoryPanel";
import { Notice } from "./Notice";
import { EmptyState } from "./ProductCollections";
import { TerminalPanel } from "./TerminalPanel";

export type BottomPanelTab = WorkspaceBottomPanelTab;

const tabs: readonly {
  readonly id: BottomPanelTab;
  readonly label: string;
  readonly icon: Parameters<typeof Icon>[0]["name"];
}[] = [
  { id: "shelf", label: "Shelf", icon: "shelf" },
  { id: "stash", label: "Stash", icon: "stash" },
  { id: "recovery", label: "Recovery", icon: "history" },
  { id: "find", label: "Find", icon: "search" },
  { id: "localHistory", label: "Local History", icon: "history" },
  { id: "gitConsole", label: "Git Console", icon: "branch" },
  { id: "terminal", label: "Terminal", icon: "console" },
];

function isBottomPanelTab(value: unknown): value is BottomPanelTab {
  return tabs.some((tab) => tab.id === value);
}

type StashMutation = "create" | "apply" | "pop" | "branch" | "drop" | "clear";

export const BottomPanel = memo(function BottomPanel({
  status,
  shelves,
  stashes,
  recoveryEntries,
  gitConsoleEntries,
  onOperation,
  onCreateShelf,
  onApplyShelf,
  onDeleteShelf,
  onRestoreRecovery,
  onClearGitConsole,
  onLoadLocalHistoryActivities,
  onLoadLocalHistoryActivity,
  onLoadLocalHistoryDiff,
  onRevertLocalHistory,
  onCreateLocalHistoryPatch,
  onPutLocalHistoryLabel,
  findResults,
  onOpenFindResult,
  onSearchAgain,
  onOpenStashDiff,
  onLoadStashFiles,
  repositoryId,
  repositoryName,
  fixture,
  collapsed,
  onToggle,
  height,
  onHeightChange,
  active,
  onActiveChange,
}: {
  readonly status: StatusModel;
  readonly shelves: readonly ShelfEntry[];
  readonly stashes: readonly StashEntry[];
  readonly recoveryEntries: readonly RecoveryEntry[];
  readonly gitConsoleEntries: readonly GitConsoleEntry[];
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onCreateShelf: (message: string, paths: readonly string[]) => void;
  readonly onApplyShelf: (shelfId: string, drop: boolean) => void;
  readonly onDeleteShelf: (shelfId: string) => void;
  readonly onRestoreRecovery: (entryId: string) => Promise<void>;
  readonly onClearGitConsole: () => void;
  readonly onLoadLocalHistoryActivities: (
    scope: GitLocalHistoryScope,
    cursor: string | null,
    limit: number,
    query: string,
    showSystemEvents: boolean,
  ) => Promise<GitLocalHistoryActivitiesPage>;
  readonly onLoadLocalHistoryActivity: (
    activityId: string,
  ) => Promise<GitLocalHistoryActivityDetail>;
  readonly onLoadLocalHistoryDiff: (activityId: string, path: string) => Promise<string>;
  readonly onRevertLocalHistory: (
    activityId: string,
    paths: readonly string[],
    includeLater: boolean,
  ) => Promise<void>;
  readonly onCreateLocalHistoryPatch: (
    activityId: string,
    paths: readonly string[],
  ) => Promise<string>;
  readonly onPutLocalHistoryLabel: (label: string) => Promise<GitLocalHistoryActivity>;
  readonly findResults: FindResultsSession | null;
  readonly onOpenFindResult: (result: ProjectSearchResult) => void;
  readonly onSearchAgain: () => void;
  readonly onOpenStashDiff: (stash: StashEntry) => void;
  readonly onLoadStashFiles: (stash: StashEntry) => Promise<readonly FileChange[]>;
  readonly repositoryId: string;
  readonly repositoryName: string;
  readonly fixture: boolean;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly height: number;
  readonly onHeightChange: (height: number) => void;
  readonly active: BottomPanelTab;
  readonly onActiveChange: (active: BottomPanelTab) => void;
}) {
  const [explicitlyOpened, setExplicitlyOpened] = useState(false);
  const [localHistoryPath, setLocalHistoryPath] = useState<string>();
  const [stashFiles, setStashFiles] = useState<Readonly<Record<string, readonly FileChange[]>>>({});
  const [stashLoadError, setStashLoadError] = useState<string>();
  const [stashMutation, setStashMutation] = useState<StashMutation | null>(null);
  const dialog = useAppDialog();
  const panel = useRef<HTMLElement>(null);
  const originFocus = useRef<HTMLElement | null>(null);
  const stashMutationRef = useRef<StashMutation | null>(null);

  useEffect(() => {
    const rememberExternalFocus = (event: FocusEvent): void => {
      if (!(event.target instanceof HTMLElement)) return;
      if (panel.current?.contains(event.target)) return;
      originFocus.current = event.target;
    };
    window.addEventListener("focusin", rememberExternalFocus);
    return () => window.removeEventListener("focusin", rememberExternalFocus);
  }, []);

  const hidePanel = (): void => {
    if (collapsed) return;
    onToggle();
    const target = originFocus.current;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  };

  useEffect(() => {
    const openTerminal = (): void => {
      onActiveChange("terminal");
      setExplicitlyOpened(true);
      if (collapsed) onToggle();
      window.requestAnimationFrame(() => {
        const terminalInput = document.querySelector<HTMLElement>(
          '[data-command-scope="terminal"] textarea, [data-command-scope="terminal"] [contenteditable="true"], [data-command-scope="terminal"]',
        );
        terminalInput?.focus();
      });
    };
    window.addEventListener("git-client:open-terminal", openTerminal);
    return () => window.removeEventListener("git-client:open-terminal", openTerminal);
  }, [collapsed, onActiveChange, onToggle]);

  useEffect(() => {
    const openLocalHistory = (event: Event): void => {
      const path =
        event instanceof CustomEvent && typeof event.detail?.path === "string"
          ? event.detail.path
          : undefined;
      setLocalHistoryPath(path);
      onActiveChange("localHistory");
      setExplicitlyOpened(true);
      if (collapsed) onToggle();
    };
    window.addEventListener("git-client:open-local-history", openLocalHistory);
    return () => window.removeEventListener("git-client:open-local-history", openLocalHistory);
  }, [collapsed, onActiveChange, onToggle]);

  useEffect(() => {
    const openGitConsole = (): void => {
      onActiveChange("gitConsole");
      setExplicitlyOpened(true);
      if (collapsed) onToggle();
      window.requestAnimationFrame(() => {
        panel.current?.querySelector<HTMLElement>('[aria-label="Git Console"]')?.focus();
      });
    };
    window.addEventListener("git-client:open-git-console", openGitConsole);
    return () => window.removeEventListener("git-client:open-git-console", openGitConsole);
  }, [collapsed, onActiveChange, onToggle]);

  useEffect(() => {
    const openPanel = (event: Event): void => {
      const requested = event instanceof CustomEvent ? event.detail?.tab : undefined;
      if (!isBottomPanelTab(requested)) return;
      onActiveChange(requested);
      setExplicitlyOpened(true);
      if (collapsed) onToggle();
    };
    window.addEventListener("git-client:open-bottom-panel", openPanel);
    return () => window.removeEventListener("git-client:open-bottom-panel", openPanel);
  }, [collapsed, onActiveChange, onToggle]);

  useEffect(() => {
    const activeIsEmpty =
      (active === "shelf" && shelves.length === 0) ||
      (active === "stash" && stashes.length === 0) ||
      (active === "recovery" && recoveryEntries.length === 0);
    if (!collapsed && !explicitlyOpened && activeIsEmpty) onToggle();
  }, [
    active,
    collapsed,
    explicitlyOpened,
    onToggle,
    recoveryEntries.length,
    shelves.length,
    stashes.length,
  ]);

  const resizePanel = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    const move = (pointerEvent: PointerEvent): void => {
      onHeightChange(
        Math.min(
          MAX_BOTTOM_PANEL_HEIGHT,
          Math.max(MIN_BOTTOM_PANEL_HEIGHT, startHeight + startY - pointerEvent.clientY),
        ),
      );
    };
    const finish = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
  };
  const resizePanelWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Home") onHeightChange(MIN_BOTTOM_PANEL_HEIGHT);
    else if (event.key === "End") onHeightChange(MAX_BOTTOM_PANEL_HEIGHT);
    else if (event.key === "ArrowUp")
      onHeightChange(Math.min(MAX_BOTTOM_PANEL_HEIGHT, height + 10));
    else if (event.key === "ArrowDown")
      onHeightChange(Math.max(MIN_BOTTOM_PANEL_HEIGHT, height - 10));
    else return;
    event.preventDefault();
  };

  const toggleStashFiles = async (stash: StashEntry): Promise<void> => {
    setStashLoadError(undefined);
    if (stashFiles[stash.oid]) {
      setStashFiles((current) => {
        const next = { ...current };
        delete next[stash.oid];
        return next;
      });
      return;
    }
    try {
      const files = await onLoadStashFiles(stash);
      setStashFiles((current) => ({ ...current, [stash.oid]: files }));
    } catch (error) {
      setStashLoadError(error instanceof Error ? error.message : String(error));
    }
  };
  const runStashMutation = useCallback(
    async (mutation: StashMutation, action: () => Promise<void>): Promise<void> => {
      if (stashMutationRef.current !== null) return;
      stashMutationRef.current = mutation;
      setStashMutation(mutation);
      try {
        await action();
      } finally {
        stashMutationRef.current = null;
        setStashMutation(null);
      }
    },
    [],
  );
  const stashChanges = useCallback(async (): Promise<void> => {
    await runStashMutation("create", async () => {
      const stashMessage = await dialog.input({
        title: "Stash changes",
        label: "Message (optional)",
        initialValue: "WIP",
        allowEmpty: true,
        description: "Includes untracked files and stores the current index state in the stash.",
        confirmLabel: "Stash",
      });
      if (stashMessage === null) return;
      await onOperation({
        kind: "stashPush",
        message: stashMessage || null,
        includeUntracked: true,
        keepIndex: false,
      });
    });
  }, [dialog.input, onOperation, runStashMutation]);
  const applyStash = useCallback(
    async (stash: StashEntry, pop: boolean): Promise<void> => {
      await runStashMutation(pop ? "pop" : "apply", async () => {
        const accepted = await dialog.confirm({
          title: `${pop ? "Pop" : "Apply"} ${stash.selector}?`,
          description: pop
            ? "Apply the saved changes and drop the stash only after Git succeeds."
            : "Apply the saved changes while retaining the stash entry.",
          impact: stash.subject,
          confirmLabel: pop ? "Pop stash" : "Apply stash",
          dangerous: pop,
        });
        if (!accepted) return;
        await onOperation({
          kind: "stashApply",
          stash: stash.selector,
          pop,
          reinstateIndex: true,
        });
      });
    },
    [dialog.confirm, onOperation, runStashMutation],
  );
  const dropStash = useCallback(
    async (stash: StashEntry): Promise<void> => {
      await runStashMutation("drop", async () => {
        const accepted = await dialog.confirm({
          title: `Drop ${stash.selector}?`,
          description: "This removes the stash entry from refs/stash.",
          impact: stash.subject,
          confirmLabel: "Drop stash",
          dangerous: true,
        });
        if (!accepted) return;
        await onOperation({ kind: "stashDrop", stash: stash.selector });
      });
    },
    [dialog.confirm, onOperation, runStashMutation],
  );
  const shelveChanges = useCallback(async (): Promise<void> => {
    const message = await dialog.input({
      title: "Shelve changes",
      label: "Shelf name",
      initialValue: "WIP: ",
      description: `Stores ${status.changes.length} changed files outside the repository.`,
      confirmLabel: "Shelve",
    });
    if (!message) return;
    onCreateShelf(
      message,
      status.changes.map((file) => file.path),
    );
  }, [dialog.input, onCreateShelf, status.changes]);

  useEffect(() => {
    const openStashDialog = (): void => {
      onActiveChange("stash");
      setExplicitlyOpened(true);
      if (collapsed) onToggle();
      void stashChanges();
    };
    window.addEventListener("git-client:stash-changes", openStashDialog);
    return () => window.removeEventListener("git-client:stash-changes", openStashDialog);
  }, [collapsed, onActiveChange, onToggle, stashChanges]);

  useEffect(() => {
    const openShelfDialog = (): void => {
      onActiveChange("shelf");
      setExplicitlyOpened(true);
      if (collapsed) onToggle();
      void shelveChanges();
    };
    window.addEventListener("git-client:shelve-changes", openShelfDialog);
    return () => window.removeEventListener("git-client:shelve-changes", openShelfDialog);
  }, [collapsed, onActiveChange, onToggle, shelveChanges]);
  return (
    <section
      aria-label={`${active} Tool Window`}
      className={`${tw.bottomPanel} ${collapsed ? tw.bottomCollapsed : ""} ${active === "terminal" ? tw.bottomTerminalPanel : ""}`}
      data-tool-window-position="bottom"
      ref={panel}
      style={collapsed ? undefined : { height }}
    >
      {!collapsed && (
        <div
          aria-label="Resize bottom panel"
          aria-orientation="horizontal"
          aria-valuemax={MAX_BOTTOM_PANEL_HEIGHT}
          aria-valuemin={MIN_BOTTOM_PANEL_HEIGHT}
          aria-valuenow={height}
          className={tw.bottomResizer}
          onDoubleClick={() => onHeightChange(DEFAULT_BOTTOM_PANEL_HEIGHT)}
          onKeyDown={resizePanelWithKeyboard}
          onPointerDown={resizePanel}
          role="separator"
          tabIndex={0}
        />
      )}
      {(collapsed || active !== "terminal") && (
        <Tabs
          className="contents"
          onValueChange={(value) => {
            if (!isBottomPanelTab(value)) return;
            onActiveChange(value);
            setExplicitlyOpened(true);
            if (collapsed) onToggle();
          }}
          value={active}
        >
          <div className={tw.toolTabs}>
            <TabsList activateOnFocus aria-label="Bottom tool windows" className="contents">
              {tabs.map((tab) => (
                <TabsTrigger
                  aria-controls="bottom-tool-panel"
                  aria-label={`${tab.label} Tool Window Tab`}
                  data-bottom-tab={tab.id}
                  id={`bottom-tool-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => {
                    if (tab.id !== active) return;
                    setExplicitlyOpened(true);
                    if (collapsed) onToggle();
                  }}
                  value={tab.id}
                  className={cn(
                    "inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 data-active:bg-accent data-active:text-foreground disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                    active === tab.id ? tw.activeToolTab : undefined,
                  )}
                >
                  <Icon name={tab.icon} size={14} />
                  {tab.label}
                  {tab.id === "stash" && status.stashCount > 0 && <em>{status.stashCount}</em>}
                </TabsTrigger>
              ))}
            </TabsList>
            <span />
            {(collapsed || active !== "terminal" || fixture) && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={collapsed ? "Show" : "Hide"}
                      onClick={collapsed ? onToggle : hidePanel}
                      type="button"
                      className="text-muted-foreground"
                      variant="ghost"
                      size="icon-sm"
                    >
                      {collapsed ? "⌃" : "⌄"}
                    </Button>
                  }
                />
                <TooltipContent>{collapsed ? "Show" : "Hide"}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </Tabs>
      )}
      {!collapsed && (
        <div
          aria-labelledby={`bottom-tool-tab-${active}`}
          className={tw.toolContent}
          id="bottom-tool-panel"
          role="tabpanel"
        >
          {active === "shelf" && (
            <div className={tw.collectionTool}>
              <div className={tw.collectionIntro}>
                <Icon name="shelf" size={24} />
                <div>
                  <strong>Shelf</strong>
                  <p>
                    Index, worktree, and untracked files are stored atomically outside the
                    repository.
                  </p>
                </div>
                <Button
                  onClick={() => void shelveChanges()}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Shelve Changes…
                </Button>
              </div>
              {stashLoadError && (
                <Notice
                  className="rounded-none border-x-0 px-3.5 py-1.5"
                  role="alert"
                  size="sm"
                  tone="destructive"
                >
                  {stashLoadError}
                </Notice>
              )}
              {shelves.map((shelf) => (
                <div className={tw.collectionRow} key={shelf.id}>
                  <Icon name="patch" size={16} />
                  <div>
                    <strong>{shelf.message}</strong>
                    <small>
                      {new Date(shelf.createdAtMs).toLocaleString()} · {shelf.files.length} files ·
                      checksum verified
                    </small>
                  </div>
                  <Button
                    onClick={() => onApplyShelf(shelf.id, false)}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    Apply
                  </Button>
                  <Button
                    onClick={() => onApplyShelf(shelf.id, true)}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    Unshelve
                  </Button>
                  <Button
                    aria-label={`Delete ${shelf.message}`}
                    onClick={toVoidHandler(async () => {
                      const accepted = await dialog.confirm({
                        title: `Delete shelf “${shelf.message}”?`,
                        description:
                          "The stored patches and untracked file copies will be deleted.",
                        impact: `${shelf.files.length} files`,
                        confirmLabel: "Delete shelf",
                        dangerous: true,
                      });
                      if (accepted) onDeleteShelf(shelf.id);
                    })}
                    type="button"
                    className="text-muted-foreground"
                    variant="ghost"
                    size="icon-sm"
                  >
                    <Icon name="trash" size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {active === "stash" && (
            <div className={tw.collectionTool}>
              <div className={tw.collectionIntro}>
                <Icon name="stash" size={24} />
                <div>
                  <strong>Git Stash</strong>
                  <p>Native stash entries from refs/stash.</p>
                </div>
                <Button
                  aria-busy={stashMutation === "create"}
                  disabled={stashMutation !== null}
                  onClick={() => void stashChanges()}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Stash Changes…
                </Button>
                <Button
                  aria-busy={stashMutation === "clear"}
                  disabled={stashes.length === 0 || stashMutation !== null}
                  onClick={toVoidHandler(async () => {
                    await runStashMutation("clear", async () => {
                      const accepted = await dialog.confirm({
                        title: "Clear every stash entry?",
                        description: "This removes refs/stash and all entries in its reflog.",
                        impact: `${stashes.length} stash entries`,
                        confirmLabel: "Clear stashes",
                        dangerous: true,
                      });
                      if (!accepted) return;
                      await onOperation({ kind: "stashClear" });
                    });
                  })}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Clear all…
                </Button>
              </div>
              {stashes.length === 0 ? (
                <EmptyState title="No entries in refs/stash." />
              ) : (
                stashes.map((stash) => (
                  <div className={tw.stashEntry} key={stash.oid}>
                    <div className={tw.collectionRow}>
                      <Icon name="commit" size={16} />
                      <div>
                        <strong>
                          {stash.selector}: {stash.subject}
                        </strong>
                        <small>
                          {stash.author} · {new Date(stash.createdAt * 1000).toLocaleString()} ·{" "}
                          {stash.oid.slice(0, 10)}
                        </small>
                      </div>
                      <Button
                        onClick={() => void toggleStashFiles(stash)}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
                      >
                        {stashFiles[stash.oid] ? "Hide Files" : "Files"}
                      </Button>
                      <Button
                        onClick={() => onOpenStashDiff(stash)}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
                      >
                        Show Diff
                      </Button>
                      <Button
                        aria-busy={stashMutation === "apply"}
                        disabled={stashMutation !== null}
                        onClick={() => void applyStash(stash, false)}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
                      >
                        Apply
                      </Button>
                      <Button
                        aria-busy={stashMutation === "pop"}
                        disabled={stashMutation !== null}
                        onClick={() => void applyStash(stash, true)}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
                      >
                        Pop
                      </Button>
                      <Button
                        aria-busy={stashMutation === "branch"}
                        disabled={stashMutation !== null}
                        onClick={toVoidHandler(async () => {
                          await runStashMutation("branch", async () => {
                            const branch = await dialog.input({
                              title: `Branch from ${stash.selector}`,
                              label: "New branch name",
                              initialValue: "stash/",
                              description:
                                "Creates the branch at the stash base, applies the stash, then drops it on success.",
                            });
                            if (!branch) return;
                            await onOperation({
                              kind: "stashBranch",
                              stash: stash.selector,
                              branch,
                            });
                          });
                        })}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
                      >
                        Branch…
                      </Button>
                      <Button
                        aria-busy={stashMutation === "drop"}
                        disabled={stashMutation !== null}
                        onClick={() => void dropStash(stash)}
                        type="button"
                        className={cn("h-7 px-2.5")}
                        variant="outline"
                        size="sm"
                      >
                        Drop
                      </Button>
                    </div>
                    {stashFiles[stash.oid] && (
                      <div className={tw.stashFiles}>
                        {(stashFiles[stash.oid] ?? []).map((file) => (
                          <span key={`${stash.oid}-${file.path}`}>
                            <strong>{file.status.charAt(0).toUpperCase()}</strong>
                            {file.oldPath ? `${file.oldPath} → ` : ""}
                            {file.path}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {active === "recovery" && (
            <div className={tw.collectionTool}>
              <div className={tw.collectionIntro}>
                <Icon name="history" size={24} />
                <div>
                  <strong>Ref Recovery Ledger</strong>
                  <p>Ref OIDs captured before history-changing operations.</p>
                </div>
              </div>
              {recoveryEntries.length === 0 ? (
                <EmptyState title="No ref-changing operations recorded yet." />
              ) : (
                recoveryEntries.map((entry) => (
                  <div className={tw.collectionRow} key={entry.id}>
                    <Icon name="history" size={16} />
                    <div>
                      <strong>{entry.operation}</strong>
                      <small>
                        {new Date(entry.createdAtMs).toLocaleString()} ·{" "}
                        {entry.branch ?? "detached"}
                        {entry.refs.map((reference) => ` · ${reference.name}`).join("")}
                      </small>
                    </div>
                    <Button
                      disabled={!entry.recoverable}
                      onClick={toVoidHandler(async () => {
                        const refs = entry.refs.map((reference) => reference.name).join("\n");
                        const accepted = await dialog.confirm({
                          title: "Restore the recorded ref state?",
                          description:
                            "Each ref is restored only if it still matches the expected post-operation value.",
                          impact: refs,
                          confirmLabel: "Restore refs",
                          dangerous: true,
                        });
                        if (!accepted) return;
                        void onRestoreRecovery(entry.id);
                      })}
                      type="button"
                      className={cn("h-7 px-2.5")}
                      variant="outline"
                      size="sm"
                    >
                      {entry.recoverable ? "Restore refs" : "Objects expired"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
          {active === "find" && (
            <FindResultsPanel
              onOpenResult={onOpenFindResult}
              onSearchAgain={onSearchAgain}
              session={findResults}
            />
          )}
          {active === "terminal" && (
            <TerminalPanel fixture={fixture} onHide={hidePanel} repositoryId={repositoryId} />
          )}
          {active === "gitConsole" && (
            <GitConsolePanel entries={gitConsoleEntries} onClear={onClearGitConsole} />
          )}
          {active === "localHistory" && (
            <LocalHistoryPanel
              initialPath={localHistoryPath}
              loadActivities={onLoadLocalHistoryActivities}
              loadActivity={onLoadLocalHistoryActivity}
              loadDiff={onLoadLocalHistoryDiff}
              onCreatePatch={onCreateLocalHistoryPatch}
              onPutLabel={onPutLocalHistoryLabel}
              onRevert={onRevertLocalHistory}
              repositoryId={repositoryId}
              repositoryName={repositoryName}
            />
          )}
        </div>
      )}
      {dialog.node}
    </section>
  );
});
