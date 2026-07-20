import { GitBranch } from "lucide-react";
import {
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { isAppearanceTheme, type AppearancePreference } from "../domain/appearance";
import type { RecentProject } from "../domain/recentProjects";
import { writeClipboardText } from "../platform/electronActions";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { CheckboxInput, Selector } from "./ui/form-controls";

type WelcomeSection = "projects" | "customize";

const SECTIONS: readonly WelcomeSection[] = ["projects", "customize"];

function sectionLabel(section: WelcomeSection): string {
  if (section === "projects") return "Projects";
  return "Customize";
}

function displayPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+(?=\/|$)/, "~");
}

function projectMonogram(name: string): string {
  const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const first = words[0] ?? name;
  const second = words[1];
  return (
    second === undefined ? first.slice(0, 2) : `${first.slice(0, 1)}${second.slice(0, 1)}`
  ).toUpperCase();
}

export function WelcomeWorkspace({
  appearancePreference,
  onAppearancePreferenceChange,
  onCloneRepository,
  onNewProject,
  onOpenRepository,
  onOpenRecent,
  onOpenSettings,
  recentProjects,
}: {
  readonly appearancePreference: AppearancePreference;
  readonly onAppearancePreferenceChange: (preference: AppearancePreference) => void;
  readonly onCloneRepository: () => void;
  readonly onNewProject: () => void;
  readonly onOpenRepository: () => void;
  readonly onOpenRecent: (path: string) => void;
  readonly onOpenSettings: () => void;
  readonly recentProjects: readonly RecentProject[];
}) {
  const [section, setSection] = useState<WelcomeSection>("projects");
  const [query, setQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState(0);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const navRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredProjects = useMemo(() => {
    if (deferredQuery.length === 0) return recentProjects;
    return recentProjects.filter((project) =>
      [project.name, project.path, project.branch ?? ""].some((value) =>
        value.toLocaleLowerCase().includes(deferredQuery),
      ),
    );
  }, [deferredQuery, recentProjects]);

  const selectSectionFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const next = (index + direction + SECTIONS.length) % SECTIONS.length;
    setSection(SECTIONS[next] ?? "projects");
    navRefs.current[next]?.focus();
  };

  const openDroppedDirectory = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (file === null) return;
    const path = Reflect.get(file, "path");
    if (typeof path === "string" && path.length > 0) onOpenRecent(path);
  };

  return (
    <main
      className={tw.welcomeWorkspace}
      onDragOver={(event) => event.preventDefault()}
      onDrop={openDroppedDirectory}
    >
      <aside
        aria-label="Welcome screen categories"
        className={tw.welcomeSidebar}
        data-testid="welcome-sidebar"
      >
        <div className={tw.welcomeBrand}>
          <a
            aria-label="Copy About"
            className={tw.welcomeBrandMark}
            href="#copy-about"
            onClick={(event) => {
              event.preventDefault();
              void writeClipboardText("Git Client 0.1.0");
            }}
          >
            <Icon name="branch" size={19} />
          </a>
          <span>
            <strong>Git Client</strong>
            <small>0.1.0</small>
          </span>
        </div>
        <div aria-label="Welcome screen categories" className={tw.welcomeNavigation} role="tree">
          {SECTIONS.map((item, index) => (
            <button
              aria-current={section === item ? "page" : undefined}
              aria-selected={section === item}
              key={item}
              onClick={() => setSection(item)}
              onKeyDown={(event) => selectSectionFromKeyboard(event, index)}
              ref={(node) => {
                navRefs.current[index] = node;
              }}
              role="treeitem"
            >
              {sectionLabel(item)}
            </button>
          ))}
        </div>
        <button
          aria-label="Options Menu"
          className={tw.welcomeSettingsButton}
          onClick={onOpenSettings}
        >
          <Icon name="settings" size={16} />
        </button>
      </aside>

      {section === "projects" && recentProjects.length === 0 && (
        <section aria-labelledby="welcome-title" className={tw.welcomeProjects}>
          <header>
            <h1 id="welcome-title">Welcome to Git Client</h1>
            <p>Create a new project to start from scratch.</p>
            <p>Open an existing project from disk or version control.</p>
          </header>
          <div aria-label="Project actions" className={tw.welcomeProjectActions}>
            <button onClick={onNewProject}>
              <span>
                <Icon name="plus" size={24} />
              </span>
              New Project
            </button>
            <button onClick={onOpenRepository}>
              <span>
                <Icon name="folder" size={24} />
              </span>
              Open
            </button>
            <button onClick={onCloneRepository}>
              <span>
                <Icon name="branch" size={24} />
              </span>
              Clone Repository
            </button>
          </div>
        </section>
      )}

      {section === "projects" && recentProjects.length > 0 && (
        <section aria-label="Projects" className="min-h-0 overflow-auto bg-[var(--card)] px-[11px]">
          <div
            className="flex h-[68px] items-center gap-2 border-b border-[var(--border)] pr-[10px]"
            data-testid="welcome-project-toolbar"
          >
            <label className="flex min-w-0 flex-1 items-center gap-[9px] px-[9px] text-[var(--muted-foreground)]">
              <Icon name="search" size={15} />
              <span className={tw.srOnly}>Search projects</span>
              <input
                className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setSelectedProject(0);
                }}
                placeholder="Search projects"
                value={query}
              />
            </label>
            <button
              className="h-7 w-[102px] whitespace-nowrap rounded border border-[var(--input)] bg-[var(--card)] px-[13px] text-[12px]"
              onClick={onNewProject}
            >
              New Project
            </button>
            <button
              className="h-7 w-[71px] whitespace-nowrap rounded border border-[var(--input)] bg-[var(--card)] px-[14px] text-[12px]"
              onClick={onOpenRepository}
            >
              Open
            </button>
            <button
              className="h-7 w-[133px] whitespace-nowrap rounded border border-[var(--input)] bg-[var(--card)] px-[13px] text-[12px]"
              onClick={onCloneRepository}
            >
              Clone Repository
            </button>
          </div>
          <div
            aria-label="Recent Projects"
            className="pt-[16px] outline-none"
            onKeyDown={(event) => {
              if (filteredProjects.length === 0) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const delta = event.key === "ArrowDown" ? 1 : -1;
                setSelectedProject(
                  (selectedProject + delta + filteredProjects.length) % filteredProjects.length,
                );
              }
              if (event.key === "Enter")
                onOpenRecent(filteredProjects[selectedProject]?.path ?? "");
            }}
            role="listbox"
            tabIndex={0}
          >
            {filteredProjects.map((project, index) => (
              <button
                aria-selected={selectedProject === index}
                className="flex min-h-[58px] w-full items-start gap-[13px] rounded px-[23px] py-[8px] text-left hover:bg-[var(--muted)] focus-visible:bg-[var(--accent)]"
                key={project.path}
                onClick={() => setSelectedProject(index)}
                onDoubleClick={() => onOpenRecent(project.path)}
                role="option"
              >
                <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#5a91d8] text-[9px] font-bold text-white">
                  {projectMonogram(project.name)}
                </span>
                <span className="min-w-0">
                  <strong className="block text-[13px] font-medium leading-[18px]">
                    {project.name}
                  </strong>
                  <small className="block truncate text-[12px] leading-[17px] text-[var(--muted-foreground)]">
                    {displayPath(project.path)}
                  </small>
                  {project.branch !== null && (
                    <small className="flex items-center gap-1 text-[12px] leading-[17px] text-[var(--muted-foreground)]">
                      <GitBranch aria-hidden size={12} strokeWidth={1.5} />
                      {project.branch}
                    </small>
                  )}
                </span>
              </button>
            ))}
            {filteredProjects.length === 0 && (
              <p className="px-5 py-3 text-[var(--muted-foreground)]">No projects found.</p>
            )}
          </div>
        </section>
      )}

      {section === "customize" && (
        <section aria-label="Customize" className={tw.welcomeCustomize}>
          <section>
            <h1 className="m-0 mb-[18px] text-[16px] font-semibold leading-[20px]">Appearance</h1>
            <div className="grid grid-cols-[59px_280px_minmax(0,1fr)] items-center gap-x-[10px] gap-y-[10px]">
              <label className="text-right text-[13px]" htmlFor="welcome-theme">
                Theme:
              </label>
              <Selector
                className="rounded-[4px] bg-[var(--card)] text-[13px]"
                id="welcome-theme"
                isLabelHidden
                label="Theme"
                onChange={(value) => {
                  if (!isAppearanceTheme(value)) return;
                  onAppearancePreferenceChange({
                    theme: value,
                    syncWithOs: false,
                  });
                }}
                options={[
                  { value: "light", label: "Islands Light" },
                  { value: "dark", label: "Islands Dark" },
                ]}
                size="sm"
                value={appearancePreference.theme}
                width={191}
              />
              <span className="flex -translate-x-[89px] items-center">
                <CheckboxInput
                  className="min-h-7 items-center whitespace-nowrap text-[13px]"
                  label="Sync with OS"
                  onChange={(syncWithOs) =>
                    onAppearancePreferenceChange({
                      ...appearancePreference,
                      syncWithOs,
                    })
                  }
                  size="sm"
                  value={appearancePreference.syncWithOs}
                />
              </span>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
