import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RecentProject } from "../domain/recentProjects";
import type { RepositorySnapshot } from "../shared/contracts/model/index";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";

type ProjectSwitcherItem =
  | { readonly kind: "open"; readonly repository: RepositorySnapshot }
  | { readonly kind: "recent"; readonly project: RecentProject };

function displayPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+(?=\/|$)/, "~");
}

export function ProjectSwitcherPopup({
  activeRepositoryId,
  onActivate,
  onClone,
  onClose,
  onOpen,
  onOpenRecent,
  onRemoveRecent,
  openRepositories,
  recentProjects,
}: {
  readonly activeRepositoryId: string;
  readonly onActivate: (repositoryId: string) => Promise<void>;
  readonly onClone: () => void;
  readonly onClose: () => void;
  readonly onOpen: () => void;
  readonly onOpenRecent: (path: string) => Promise<void>;
  readonly onRemoveRecent: (path: string) => void;
  readonly openRepositories: readonly RepositorySnapshot[];
  readonly recentProjects: readonly RecentProject[];
}) {
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openPaths = useMemo(
    () => new Set(openRepositories.map((repository) => repository.path)),
    [openRepositories],
  );
  const availableRecentProjects = useMemo(
    () => recentProjects.filter((project) => !openPaths.has(project.path)),
    [openPaths, recentProjects],
  );
  const items = useMemo<readonly ProjectSwitcherItem[]>(
    () => [
      ...openRepositories.map(
        (repository) => ({ kind: "open", repository }) as const,
      ),
      ...availableRecentProjects.map(
        (project) => ({ kind: "recent", project }) as const,
      ),
    ],
    [availableRecentProjects, openRepositories],
  );

  useDismissLayer(
    useMemo(
      () => ({
        id: "project-switcher-popup",
        priority: 120,
        active: true,
        dismiss: onClose,
      }),
      [onClose],
    ),
  );

  useEffect(() => {
    itemRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, items.length + 1));
  }, [items.length]);

  const runItem = async (item: ProjectSwitcherItem): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (item.kind === "open") await onActivate(item.repository.id);
      else await onOpenRecent(item.project.path);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const focusItem = (index: number): void => {
    const itemCount = items.length + 2;
    const next = (index + itemCount) % itemCount;
    setActiveIndex(next);
    itemRefs.current[next]?.focus();
  };

  const moveFocusWithTab = (backward: boolean): void => {
    focusItem(activeIndex + (backward ? -1 : 1));
  };

  const activateItem = (index: number): void => {
    if (index === 0) {
      onClose();
      onOpen();
      return;
    }
    if (index === 1) {
      onClose();
      onClone();
      return;
    }
    const item = items[index - 2];
    if (item) void runItem(item);
  };

  return (
    <dialog
      open
      aria-label="Projects"
      className={`projectSwitcherPopup projectSwitcherPopup [position:absolute] [top:calc(100%_+_2px)] [left:0] [z-index:var(--layer-floating-panel)] [max-height:min(540px,_calc(100vh_-_62px))] [min-width:368px] [overflow:auto] rounded-lg [padding:0_0_5px] [box-shadow:var(--shadow-lg)] [background:var(--popover)] [border:1px_solid_var(--input)] [&_[data-project-section]]:[display:block] [&_[data-project-section]]:[padding:8px_11px_4px] [&_[data-project-section]]:[font-size:10px] [&_[data-project-section]]:[font-weight:600] [&_[data-project-section]]:[color:var(--muted-foreground)] [&_[data-project-section]]:[border-top:1px_solid_var(--border)] [&>_p]:[margin:5px_9px] [&>_p]:[font-size:10px] [&>_p]:[color:var(--destructive)]`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "Tab") {
          event.preventDefault();
          moveFocusWithTab(event.shiftKey);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          focusItem(activeIndex + 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          focusItem(activeIndex - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          focusItem(0);
        } else if (event.key === "End") {
          event.preventDefault();
          focusItem(items.length + 1);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateItem(activeIndex);
        } else if (event.key === "Delete" || event.key === "Backspace") {
          const item = items[activeIndex - 2];
          if (item?.kind === "recent") {
            event.preventDefault();
            onRemoveRecent(item.project.path);
          }
        }
      }}
    >
      <div aria-label="Projects" role="listbox">
        <div
          className={`projectSwitcherActions projectSwitcherActions [display:grid] [padding:5px] [border-bottom:1px_solid_var(--border)] [&_button]:[display:flex] [&_button]:[height:30px] [&_button]:[align-items:center] [&_button]:[gap:8px] [&_button]:rounded-sm [&_button]:[padding:0_8px] [&_button]:[background:transparent] [&_button:hover]:[background:var(--muted)] [&_button[aria-selected=true]]:[background:var(--accent)]`}
          role="presentation"
        >
          <Button
            aria-selected={activeIndex === 0}
            onClick={() => {
              onClose();
              onOpen();
            }}
            onFocus={() => setActiveIndex(0)}
            ref={(node) => {
              itemRefs.current[0] = node;
            }}
            role="option"
            type="button"
            className={cn(
              "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
            )}
            variant="ghost"
            size="default"
            tabIndex={-1}
          >
            <Icon name="folder" size={16} />
            <span>Open…</span>
          </Button>
          <Button
            aria-selected={activeIndex === 1}
            onClick={() => {
              onClose();
              onClone();
            }}
            onFocus={() => setActiveIndex(1)}
            ref={(node) => {
              itemRefs.current[1] = node;
            }}
            role="option"
            type="button"
            className={cn(
              "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
            )}
            variant="ghost"
            size="default"
            tabIndex={-1}
          >
            <Icon name="branch" size={16} />
            <span>Clone Repository…</span>
          </Button>
        </div>

        {openRepositories.length > 0 && (
          <strong data-project-section>Open Projects</strong>
        )}
        {openRepositories.map((repository, index) => (
          <Button
            aria-current={
              repository.id === activeRepositoryId ? "true" : undefined
            }
            aria-selected={activeIndex === index + 2}
            disabled={busy}
            key={repository.id}
            data-project-switcher-row
            onClick={() => void runItem({ kind: "open", repository })}
            onFocus={() => setActiveIndex(index + 2)}
            ref={(node) => {
              itemRefs.current[index + 2] = node;
            }}
            role="option"
            type="button"
            className={cn(
              "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
              `projectSwitcherRow projectSwitcherRow [display:grid] [min-height:45px] [width:100%] [grid-template-columns:24px_minmax(0,_1fr)_16px] [align-items:center] [gap:8px] [padding:5px_8px] [text-align:left] [background:transparent] [&_b]:[overflow:hidden] [&_b]:[font-weight:600] [&_b]:[text-overflow:ellipsis] [&_b]:[white-space:nowrap] [&_small]:[overflow:hidden] [&_small]:[font-size:10px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:var(--disabled-foreground)] [&:hover]:[background:var(--muted)] [&>_span:nth-child(2)]:[display:flex] [&>_span:nth-child(2)]:[min-width:0] [&>_span:nth-child(2)]:[flex-direction:column] [&[aria-selected=true]]:[background:var(--accent)]`,
            )}
            variant="ghost"
            size="default"
          >
            <span
              className={`projectMark projectMark [display:inline-flex] [height:16px] [width:16px] [align-items:center] [justify-content:center] rounded-xs [font-size:9px] [font-weight:700] [color:var(--primary-foreground)] [background:var(--primary)]`}
            >
              {repository.name.charAt(0).toUpperCase()}
            </span>
            <span>
              <b>{repository.name}</b>
              <small>{displayPath(repository.path)}</small>
            </span>
            {repository.id === activeRepositoryId && (
              <Icon name="check" size={14} />
            )}
          </Button>
        ))}

        {availableRecentProjects.length > 0 && (
          <strong data-project-section>Recent Projects</strong>
        )}
        {availableRecentProjects.map((project, recentIndex) => {
          const index = openRepositories.length + recentIndex + 2;
          return (
            <Button
              aria-label={`${project.name}. Press Delete to remove from Recent Projects`}
              aria-keyshortcuts="Enter Delete Backspace"
              aria-selected={activeIndex === index}
              disabled={busy}
              key={project.path}
              onClick={() => void runItem({ kind: "recent", project })}
              onFocus={() => setActiveIndex(index)}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="option"
              type="button"
              data-project-switcher-row
              className={cn(
                "min-h-[29px] w-full justify-start gap-1.5 px-2 py-1 text-left text-xs whitespace-normal aria-current:bg-accent aria-selected:bg-accent",
                `projectSwitcherRow projectSwitcherRow [display:grid] [min-height:45px] [width:100%] [grid-template-columns:24px_minmax(0,_1fr)_16px] [align-items:center] [gap:8px] [padding:5px_8px] [text-align:left] [background:transparent] [&_b]:[overflow:hidden] [&_b]:[font-weight:600] [&_b]:[text-overflow:ellipsis] [&_b]:[white-space:nowrap] [&_small]:[overflow:hidden] [&_small]:[font-size:10px] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] [&_small]:[color:var(--disabled-foreground)] [&:hover]:[background:var(--muted)] [&>_span:nth-child(2)]:[display:flex] [&>_span:nth-child(2)]:[min-width:0] [&>_span:nth-child(2)]:[flex-direction:column] [&[aria-selected=true]]:[background:var(--accent)]`,
              )}
              variant="ghost"
              size="default"
            >
              <span
                className={`projectMark projectMark [display:inline-flex] [height:16px] [width:16px] [align-items:center] [justify-content:center] rounded-xs [font-size:9px] [font-weight:700] [color:var(--primary-foreground)] [background:var(--primary)]`}
              >
                {project.name.charAt(0).toUpperCase()}
              </span>
              <span>
                <b>{project.name}</b>
                <small>{displayPath(project.path)}</small>
              </span>
            </Button>
          );
        })}
      </div>

      {error && <p role="alert">{error}</p>}
    </dialog>
  );
}
