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
  readonly loadActivity: (activityId: string) => Promise<GitLocalHistoryActivityDetail>;
  readonly loadDiff: (activityId: string, path: string) => Promise<string>;
  readonly onRevert: (
    activityId: string,
    paths: readonly string[],
    includeLater: boolean,
  ) => Promise<void>;
  readonly onCreatePatch: (activityId: string, paths: readonly string[]) => Promise<string>;
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
  const [activities, setActivities] = useState<readonly GitLocalHistoryActivity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GitLocalHistoryActivityDetail | null>(null);
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
    if (initialPath !== undefined) return { kind: "file", repositoryId, path: initialPath };
    return mode === "recent" ? { kind: "recent", repositoryId } : { kind: "project", repositoryId };
  }, [initialPath, mode, repositoryId]);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const page = await loadActivities(scope, null, 500, query, showSystemEvents);
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
    window.localStorage.setItem("git-client.local-history.width", String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "f") {
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
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
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
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [loadDiff, selectedId, selectedPath]);

  const revert = async (includeLater: boolean): Promise<void> => {
    if (selectedId === null || selectedPath.length === 0) return;
    const accepted = await dialog.confirm({
      title: includeLater ? "Revert selected and later changes?" : `Revert ${selectedPath}?`,
      description: "The working tree will be changed. The Git index will not be modified.",
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
    const text = await onCreatePatch(selectedId, selectedPath ? [selectedPath] : []);
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

  const selectedChange = detail?.changes.find((change) => change.path === selectedPath) ?? null;
  const selectedChangeIndex =
    detail?.changes.findIndex((change) => change.path === selectedPath) ?? -1;

  const navigateChange = (offset: -1 | 1): void => {
    if (detail === null || detail.changes.length === 0) return;
    const index = Math.min(Math.max(selectedChangeIndex + offset, 0), detail.changes.length - 1);
    setSelectedPath(detail.changes[index]?.path ?? "");
  };

  const loadMore = async (): Promise<void> => {
    if (nextCursor === null) return;
    setLoading(true);
    try {
      const page = await loadActivities(scope, nextCursor, 500, query, showSystemEvents);
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
      setLeftWidth(Math.min(Math.max(startWidth + pointerEvent.clientX - startX, 260), 640));
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
      className="local-history-activity"
      aria-busy={loading}
      aria-label="Local History"
      style={{ gridTemplateColumns: `${leftWidth}px 4px minmax(360px, 1fr)` }}
    >
      <div className="local-history-left">
        <header className="local-history-searchbar">
          <Icon name="search" size={13} />
          <input
            aria-label="Search by file name"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by file name"
            ref={searchInput}
            value={query}
          />
          <button aria-label="Put Label" onClick={() => void putLabel()} title="Put Label…">
            <Icon name="plus" size={13} />
          </button>
          <button
            aria-label="View Options"
            aria-pressed={showSystemEvents}
            onClick={() => setShowSystemEvents((value) => !value)}
            title="Show System Events"
          >
            <Icon name="more" size={13} />
          </button>
        </header>
        <div className="local-history-activities" role="listbox" aria-label="Activity History">
          {activities.map((activity) => (
            <button
              aria-selected={activity.id === selectedId}
              key={activity.id}
              onClick={() => setSelectedId(activity.id)}
              role="option"
            >
              <Icon name={activity.label === null ? "history" : "bookmark"} size={14} />
              <span>
                <strong>{activityTitle(activity)}</strong>
                <small>
                  {new Date(activity.createdAtMs).toLocaleString()} · {activity.changeCount} change
                  {activity.changeCount === 1 ? "" : "s"}
                </small>
              </span>
            </button>
          ))}
          {!loading && activities.length === 0 && (
            <div className="local-history-empty">No activity in {repositoryName} detected</div>
          )}
          {nextCursor !== null && (
            <button className="local-history-load-more" onClick={() => void loadMore()}>
              Load More
            </button>
          )}
        </div>
        <div className="local-history-activity-actions">
          <button disabled={selectedId === null} onClick={() => void revert(true)}>
            Revert Selected and Later Changes
          </button>
          <button disabled={selectedId === null} onClick={() => void createPatch()}>
            Create Patch…
          </button>
        </div>
        <header className="local-history-changes-toolbar">
          <strong>Changes</strong>
          <button
            aria-pressed={groupByDirectory}
            onClick={() => setGroupByDirectory((value) => !value)}
            title="Group By Directory"
          >
            Group By
          </button>
          <button aria-pressed={showDiff} onClick={() => setShowDiff((value) => !value)}>
            Show Diff
          </button>
        </header>
        <div className="local-history-changes" role="tree" aria-label="Changes">
          {detail?.changes.map((change) => (
            <button
              aria-selected={change.path === selectedPath}
              key={`${change.kind}:${change.path}`}
              onClick={() => setSelectedPath(change.path)}
              role="treeitem"
            >
              <Icon
                name={change.contentAvailability === "unavailable" ? "warning" : "file"}
                size={13}
              />
              <span title={change.path}>
                {groupByDirectory
                  ? change.path
                  : change.path.slice(change.path.lastIndexOf("/") + 1)}
              </span>
              <small>{changeLabel(change.kind)}</small>
            </button>
          ))}
          {detail !== null && detail.changes.length === 0 && (
            <div className="local-history-empty">Label has no file changes</div>
          )}
          {detail === null && (
            <div className="local-history-empty">Select activity to view changes</div>
          )}
        </div>
      </div>
      <div
        aria-label="Resize Local History panels"
        aria-orientation="vertical"
        className="local-history-splitter"
        onPointerDown={resizePanels}
        role="separator"
        tabIndex={0}
      />
      <main className="local-history-diff">
        <header>
          <button
            disabled={selectedChangeIndex <= 0}
            onClick={() => navigateChange(-1)}
            title="Previous file"
          >
            ↑
          </button>
          <button
            disabled={detail === null || selectedChangeIndex >= detail.changes.length - 1}
            onClick={() => navigateChange(1)}
            title="Next file"
          >
            ↓
          </button>
          <strong>{selectedPath || "No files"}</strong>
          <button
            disabled={
              selectedChange === null || selectedChange.contentAvailability === "unavailable"
            }
            onClick={() => void revert(false)}
          >
            Revert Selection
          </button>
        </header>
        {!showDiff ? (
          <div className="local-history-empty">Nothing to show</div>
        ) : error !== null ? (
          <div className="local-history-error" role="alert">
            {error}
          </div>
        ) : selectedChange?.contentAvailability === "unavailable" ? (
          <div className="local-history-empty">Content unavailable</div>
        ) : patch.length > 0 ? (
          <pre>{patch}</pre>
        ) : (
          <div className="local-history-empty">Nothing to show</div>
        )}
      </main>
      {dialog.node}
    </section>
  );
}
