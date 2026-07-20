import { useEffect, useMemo, useRef, useState } from "react";
import type { RecentProject } from "../domain/recentProjects";
import type { RepositorySnapshot } from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
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
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
      ...openRepositories.map((repository) => ({ kind: "open", repository }) as const),
      ...availableRecentProjects.map((project) => ({ kind: "recent", project }) as const),
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

  return (
    <section
      aria-label="Projects"
      className={tw.projectSwitcherPopup}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
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
        }
      }}
      role="dialog"
    >
      <div className={tw.projectSwitcherActions}>
        <button
          onClick={() => {
            onClose();
            onOpen();
          }}
          ref={(node) => {
            itemRefs.current[0] = node;
          }}
        >
          <Icon name="folder" size={16} />
          <span>Open…</span>
        </button>
        <button
          onClick={() => {
            onClose();
            onClone();
          }}
          ref={(node) => {
            itemRefs.current[1] = node;
          }}
        >
          <Icon name="branch" size={16} />
          <span>Clone Repository…</span>
        </button>
      </div>

      {openRepositories.length > 0 && <strong>Open Projects</strong>}
      {openRepositories.map((repository, index) => (
        <button
          aria-current={repository.id === activeRepositoryId ? "true" : undefined}
          className={tw.projectSwitcherRow}
          disabled={busy}
          key={repository.id}
          onClick={() => void runItem({ kind: "open", repository })}
          ref={(node) => {
            itemRefs.current[index + 2] = node;
          }}
        >
          <span className={tw.projectMark}>{repository.name.charAt(0).toUpperCase()}</span>
          <span>
            <b>{repository.name}</b>
            <small>{displayPath(repository.path)}</small>
          </span>
          {repository.id === activeRepositoryId && <Icon name="check" size={14} />}
        </button>
      ))}

      {availableRecentProjects.length > 0 && <strong>Recent Projects</strong>}
      {availableRecentProjects.map((project, recentIndex) => {
        const index = openRepositories.length + recentIndex + 2;
        return (
          <div className={tw.projectSwitcherRecentRow} key={project.path}>
            <button
              className={tw.projectSwitcherRow}
              disabled={busy}
              onClick={() => void runItem({ kind: "recent", project })}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
            >
              <span className={tw.projectMark}>{project.name.charAt(0).toUpperCase()}</span>
              <span>
                <b>{project.name}</b>
                <small>{displayPath(project.path)}</small>
              </span>
            </button>
            <button
              aria-label={`Remove ${project.name} from Recent Projects`}
              className={tw.projectSwitcherRemove}
              onClick={() => onRemoveRecent(project.path)}
              title="Remove from Recent Projects"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        );
      })}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
