import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { Toggle } from "@jongminchung/ui/components/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GitLocalHistoryActivitiesPage,
  GitLocalHistoryActivity,
  GitLocalHistoryActivityDetail,
  GitLocalHistoryScope,
} from "../shared/contracts/git-utility";
import { useAppDialog } from "./AppDialog";
import { Icon } from "./Icon";

interface LocalHistoryPanelProps {
  readonly initialPath?: string;
  readonly repositoryId: string;
  readonly repositoryName: string;
  readonly mode?: "project" | "recent";
  readonly loadActivities: (
    scope: GitLocalHistoryScope,
    cursor: string | null,
    limit: number,
    query: string,
    showSystemEvents: boolean,
  ) => Promise<GitLocalHistoryActivitiesPage>;
  readonly loadActivity: (
    activityId: string,
  ) => Promise<GitLocalHistoryActivityDetail>;
  readonly loadDiff: (activityId: string, path: string) => Promise<string>;
  readonly onRevert: (
    activityId: string,
    paths: readonly string[],
    includeLater: boolean,
  ) => Promise<void>;
  readonly onCreatePatch: (
    activityId: string,
    paths: readonly string[],
  ) => Promise<string>;
  readonly onPutLabel: (label: string) => Promise<GitLocalHistoryActivity>;
}

function activityTitle(activity: GitLocalHistoryActivity): string {
  if (activity.label !== null) return activity.label;
  return activity.name;
}

function changeLabel(kind: string): string {
  if (kind === "content") return "Modified";
  if (kind === "create") return "Created";
  if (kind === "delete") return "Deleted";
  if (kind === "move") return "Moved";
  if (kind === "rename") return "Renamed";
  return "Permissions";
}

export function LocalHistoryPanel({
  initialPath,
  repositoryId,
  repositoryName,
  mode = "recent",
  loadActivities,
  loadActivity,
  loadDiff,
  onRevert,
  onCreatePatch,
  onPutLabel,
}: LocalHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [showSystemEvents, setShowSystemEvents] = useState(true);
  const [groupByDirectory, setGroupByDirectory] = useState(true);
  const [showDiff, setShowDiff] = useState(true);
  const [activities, setActivities] = useState<
    readonly GitLocalHistoryActivity[]
  >([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GitLocalHistoryActivityDetail | null>(
    null,
  );
  const [selectedPath, setSelectedPath] = useState(initialPath ?? "");
  const [patch, setPatch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window === "undefined") return 360;
    const stored = Number.parseInt(
      window.localStorage.getItem("git-client.local-history.width") ?? "",
      10,
    );
    return Number.isFinite(stored) ? Math.min(Math.max(stored, 260), 640) : 360;
  });
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useAppDialog();

  const scope = useMemo<GitLocalHistoryScope>(() => {
    if (initialPath !== undefined)
      return { kind: "file", repositoryId, path: initialPath };
    return mode === "recent"
      ? { kind: "recent", repositoryId }
      : { kind: "project", repositoryId };
  }, [initialPath, mode, repositoryId]);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const page = await loadActivities(
        scope,
        null,
        500,
        query,
        showSystemEvents,
      );
      setActivities(page.activities);
      setNextCursor(page.nextCursor);
      setSelectedId((current) =>
        page.activities.some((activity) => activity.id === current)
          ? current
          : (page.activities[0]?.id ?? null),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [loadActivities, query, scope, showSystemEvents]);

  useEffect(() => void reload(), [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "git-client.local-history.width",
      String(leftWidth),
    );
  }, [leftWidth]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent): void => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === "f"
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    let active = true;
    if (selectedId === null) {
      setDetail(null);
      setPatch("");
      return () => {
        active = false;
      };
    }
    void loadActivity(selectedId)
      .then((value) => {
        if (!active) return;
        setDetail(value);
        setSelectedPath((current) =>
          value.changes.some((change) => change.path === current)
            ? current
            : (value.changes[0]?.path ?? ""),
        );
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [loadActivity, selectedId]);

  useEffect(() => {
    let active = true;
    if (selectedId === null || selectedPath.length === 0) {
      setPatch("");
      return () => {
        active = false;
      };
    }
    void loadDiff(selectedId, selectedPath)
      .then((value) => {
        if (active) setPatch(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [loadDiff, selectedId, selectedPath]);

  const revert = async (includeLater: boolean): Promise<void> => {
    if (selectedId === null || selectedPath.length === 0) return;
    const accepted = await dialog.confirm({
      title: includeLater
        ? "Revert selected and later changes?"
        : `Revert ${selectedPath}?`,
      description:
        "The working tree will be changed. The Git index will not be modified.",
      impact: patch.slice(0, 2_000),
      confirmLabel: "Revert",
      dangerous: true,
    });
    if (!accepted) return;
    await onRevert(selectedId, [selectedPath], includeLater);
    await reload();
  };

  const createPatch = async (): Promise<void> => {
    if (selectedId === null) return;
    const text = await onCreatePatch(
      selectedId,
      selectedPath ? [selectedPath] : [],
    );
    await navigator.clipboard.writeText(text);
  };

  const putLabel = async (): Promise<void> => {
    const label = await dialog.input({
      title: "Put Label",
      label: "Label name:",
      confirmLabel: "OK",
    });
    if (label === null || label.trim().length === 0) return;
    await onPutLabel(label.trim());
    await reload();
  };

  const selectedChange =
    detail?.changes.find((change) => change.path === selectedPath) ?? null;
  const selectedChangeIndex =
    detail?.changes.findIndex((change) => change.path === selectedPath) ?? -1;

  const navigateChange = (offset: -1 | 1): void => {
    if (detail === null || detail.changes.length === 0) return;
    const index = Math.min(
      Math.max(selectedChangeIndex + offset, 0),
      detail.changes.length - 1,
    );
    setSelectedPath(detail.changes[index]?.path ?? "");
  };

  const loadMore = async (): Promise<void> => {
    if (nextCursor === null) return;
    setLoading(true);
    try {
      const page = await loadActivities(
        scope,
        nextCursor,
        500,
        query,
        showSystemEvents,
      );
      setActivities((current) => [...current, ...page.activities]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  };

  const resizePanels = (event: React.PointerEvent<HTMLDivElement>): void => {
    const startX = event.clientX;
    const startWidth = leftWidth;
    const move = (pointerEvent: PointerEvent): void => {
      setLeftWidth(
        Math.min(
          Math.max(startWidth + pointerEvent.clientX - startX, 260),
          640,
        ),
      );
    };
    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <section
      className="grid h-full min-h-0 min-w-0 [grid-template-columns:minmax(280px,38%)_minmax(360px,1fr)] overflow-hidden bg-card"
      data-local-history-activity
      aria-busy={loading}
      aria-label="Local History"
      style={{
        gridTemplateColumns: `${leftWidth}px 4px minmax(360px, 1fr)`,
      }}
    >
      <div className="grid min-h-0 min-w-0 grid-rows-[35px_minmax(90px,3fr)_31px_31px_minmax(90px,2fr)]">
        <header className="flex min-w-0 items-center gap-[5px] border-b border-border px-[7px] focus-within:shadow-[inset_0_-2px_var(--primary)] [&_button]:min-h-6 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-1.5 [&_button]:text-muted-foreground [&_input]:h-[27px] [&_input]:min-w-0 [&_input]:flex-1 [&_input]:border-0 [&_input]:bg-transparent [&_input]:outline-0">
          <Icon name="search" size={13} />
          <Input
            aria-label="Search by file name"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by file name"
            ref={searchInput}
            value={query}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Put Label"
                  onClick={() => void putLabel()}
                  type="button"
                  className={cn(
                    "min-h-[26px] min-w-[26px] gap-1.5 p-1 text-xs text-muted-foreground",
                  )}
                  variant="ghost"
                  size="icon-sm"
                >
                  <Icon name="plus" size={13} />
                </Button>
              }
            />
            <TooltipContent>Put Label…</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  aria-label="Show System Events"
                  onPressedChange={setShowSystemEvents}
                  pressed={showSystemEvents}
                  type="button"
                  className={cn(
                    "inline-flex min-h-[26px] min-w-[26px] items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent p-1 text-xs text-foreground text-muted-foreground transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                  )}
                >
                  <Icon name="more" size={13} />
                </Toggle>
              }
            />
            <TooltipContent>Show System Events</TooltipContent>
          </Tooltip>
        </header>
        <div
          className="[&_small]:text-disabled-foreground min-h-0 overflow-auto [&_small]:block [&_small]:truncate [&_small]:text-[length:var(--font-size-xs)] [&_small]:font-normal [&_span]:min-w-0 [&_span]:truncate [&_strong]:block [&_strong]:truncate [&>button]:grid [&>button]:min-h-[30px] [&>button]:w-full [&>button]:grid-cols-[17px_minmax(0,1fr)] [&>button]:gap-1.5 [&>button]:rounded-none [&>button]:px-2 [&>button]:py-1 [&>button]:text-left [&>button[aria-selected=true]]:bg-accent"
          role="listbox"
          aria-label="Activity History"
        >
          {activities.map((activity) => (
            <Button
              aria-selected={activity.id === selectedId}
              key={activity.id}
              onClick={() => setSelectedId(activity.id)}
              role="option"
              type="button"
              className={cn(
                "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
              )}
              variant="ghost"
              size="default"
              tabIndex={-1}
            >
              <Icon
                name={activity.label === null ? "history" : "bookmark"}
                size={14}
              />
              <span>
                <strong>{activityTitle(activity)}</strong>
                <small>
                  {new Date(activity.createdAtMs).toLocaleString()} ·{" "}
                  {activity.changeCount} change
                  {activity.changeCount === 1 ? "" : "s"}
                </small>
              </span>
            </Button>
          ))}
          {!loading && activities.length === 0 && (
            <div className="text-disabled-foreground flex h-full min-h-[58px] items-center justify-center p-3 text-center">
              No activity in {repositoryName} detected
            </div>
          )}
          {nextCursor !== null && (
            <Button
              onClick={() => void loadMore()}
              type="button"
              className={cn(
                "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
                "block min-h-[30px] text-center text-primary",
              )}
              variant="ghost"
              size="default"
            >
              Load More
            </Button>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-[5px] border-y border-border px-[7px] [&_button]:min-h-6 [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-[length:var(--font-size-xs)] [&_button]:text-muted-foreground">
          <Button
            disabled={selectedId === null}
            onClick={() => void revert(true)}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Revert Selected and Later Changes
          </Button>
          <Button
            disabled={selectedId === null}
            onClick={() => void createPatch()}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Create Patch…
          </Button>
        </div>
        <header className="flex min-w-0 items-center gap-[5px] border-b border-border px-[7px] [&_button]:min-h-6 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-1.5 [&_button]:text-muted-foreground [&>strong]:min-w-0 [&>strong]:flex-1 [&>strong]:truncate">
          <strong>Changes</strong>
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  onPressedChange={setGroupByDirectory}
                  pressed={groupByDirectory}
                  type="button"
                  className={cn(
                    "inline-flex min-h-[25px] items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-1.5 text-xs text-foreground text-muted-foreground transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                  )}
                >
                  Group By
                </Toggle>
              }
            />
            <TooltipContent>Group By Directory</TooltipContent>
          </Tooltip>
          <Toggle
            onPressedChange={setShowDiff}
            pressed={showDiff}
            type="button"
            className={cn(
              "inline-flex min-h-[25px] items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-1.5 text-xs text-foreground text-muted-foreground transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
            )}
          >
            Show Diff
          </Toggle>
        </header>
        <div
          className="[&_small]:text-disabled-foreground min-h-0 overflow-auto [&_small]:truncate [&_small]:text-[length:var(--font-size-xs)] [&_small]:font-normal [&_span]:min-w-0 [&_span]:truncate [&>button]:grid [&>button]:min-h-[30px] [&>button]:w-full [&>button]:grid-cols-[17px_minmax(0,1fr)_auto] [&>button]:gap-1.5 [&>button]:rounded-none [&>button]:px-2 [&>button]:py-1 [&>button]:text-left [&>button[aria-selected=true]]:bg-accent"
          role="tree"
          aria-label="Changes"
        >
          {detail?.changes.map((change) => (
            <Button
              aria-selected={change.path === selectedPath}
              key={`${change.kind}:${change.path}`}
              onClick={() => setSelectedPath(change.path)}
              role="treeitem"
              type="button"
              className={cn(
                "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
              )}
              variant="ghost"
              size="default"
              tabIndex={-1}
            >
              <Icon
                name={
                  change.contentAvailability === "unavailable"
                    ? "warning"
                    : "file"
                }
                size={13}
              />
              <span title={change.path}>
                {groupByDirectory
                  ? change.path
                  : change.path.slice(change.path.lastIndexOf("/") + 1)}
              </span>
              <small>{changeLabel(change.kind)}</small>
            </Button>
          ))}
          {detail !== null && detail.changes.length === 0 && (
            <div className="text-disabled-foreground flex h-full min-h-[58px] items-center justify-center p-3 text-center">
              Label has no file changes
            </div>
          )}
          {detail === null && (
            <div className="text-disabled-foreground flex h-full min-h-[58px] items-center justify-center p-3 text-center">
              Select activity to view changes
            </div>
          )}
        </div>
      </div>
      <div
        aria-label="Resize Local History panels"
        aria-orientation="vertical"
        className="relative min-h-0 cursor-ew-resize bg-border outline-0 hover:bg-primary focus-visible:bg-primary"
        onPointerDown={resizePanels}
        role="separator"
        tabIndex={0}
      />
      <main className="grid min-h-0 min-w-0 grid-rows-[35px_minmax(0,1fr)] [&>pre]:m-0 [&>pre]:overflow-auto [&>pre]:bg-card [&>pre]:px-3 [&>pre]:py-2.5 [&>pre]:text-[11px] [&>pre]:leading-[1.45] [&>pre]:[tab-size:4]">
        <header className="flex min-w-0 items-center gap-[5px] border-b border-border px-[7px] [&_button]:min-h-6 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-1.5 [&_button]:text-muted-foreground [&>strong]:min-w-0 [&>strong]:flex-1 [&>strong]:truncate">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Previous file"
                  disabled={selectedChangeIndex <= 0}
                  onClick={() => navigateChange(-1)}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  ↑
                </Button>
              }
            />
            <TooltipContent>Previous file</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Next file"
                  disabled={
                    detail === null ||
                    selectedChangeIndex >= detail.changes.length - 1
                  }
                  onClick={() => navigateChange(1)}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  ↓
                </Button>
              }
            />
            <TooltipContent>Next file</TooltipContent>
          </Tooltip>
          <strong>{selectedPath || "No files"}</strong>
          <Button
            disabled={
              selectedChange === null ||
              selectedChange.contentAvailability === "unavailable"
            }
            onClick={() => void revert(false)}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Revert Selection
          </Button>
        </header>
        {!showDiff ? (
          <div className="text-disabled-foreground flex h-full min-h-[58px] items-center justify-center p-3 text-center">
            Nothing to show
          </div>
        ) : error !== null ? (
          <div
            className="flex h-full min-h-[58px] items-center justify-center p-3 text-center text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : selectedChange?.contentAvailability === "unavailable" ? (
          <div className="text-disabled-foreground flex h-full min-h-[58px] items-center justify-center p-3 text-center">
            Content unavailable
          </div>
        ) : patch.length > 0 ? (
          <pre>{patch}</pre>
        ) : (
          <div className="text-disabled-foreground flex h-full min-h-[58px] items-center justify-center p-3 text-center">
            Nothing to show
          </div>
        )}
      </main>
      {dialog.node}
    </section>
  );
}
