import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { cn } from "@jongminchung/ui/lib/utils";
import { GitBranch } from "lucide-react";
import {
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from "react";
import packageConfig from "../../package.json";
import {
    isAppearanceTheme,
    type AppearancePreference,
} from "../domain/appearance";
import type { RecentProject } from "../domain/recentProjects";
import { writeClipboardText } from "../platform/electronActions";
import { Icon } from "./Icon";
import { CheckboxInput, Selector } from "./ProductFormControls";

type WelcomeSection = "projects" | "customize";

const SECTIONS: readonly WelcomeSection[] = ["projects", "customize"];
const WELCOME_SIDEBAR_WIDTH = 224;
const WELCOME_NAV_ITEM_WIDTH = 200;
const WELCOME_NAV_ITEM_HEIGHT = 32;
const PRODUCT_VERSION = packageConfig.version;

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
        second === undefined
            ? first.slice(0, 2)
            : `${first.slice(0, 1)}${second.slice(0, 1)}`
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
    readonly onAppearancePreferenceChange: (
        preference: AppearancePreference,
    ) => void;
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
    const navRefs = useRef<Array<HTMLElement | null>>([]);
    const projectRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const dropTargetRef = useRef<HTMLElement>(null);

    const filteredProjects = useMemo(() => {
        if (deferredQuery.length === 0) return recentProjects;
        return recentProjects.filter((project) =>
            [project.name, project.path, project.branch ?? ""].some((value) =>
                value.toLocaleLowerCase().includes(deferredQuery),
            ),
        );
    }, [deferredQuery, recentProjects]);

    useEffect(() => {
        setSelectedProject((current) =>
            Math.min(current, Math.max(0, filteredProjects.length - 1)),
        );
    }, [filteredProjects.length]);

    const selectProjectFromKeyboard = (
        event: KeyboardEvent<HTMLElement>,
    ): void => {
        if (filteredProjects.length === 0) return;
        if (event.key === "Enter") {
            event.preventDefault();
            const project = filteredProjects[selectedProject];
            if (project) onOpenRecent(project.path);
            return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
            return;
        event.preventDefault();
        const next =
            event.key === "Home"
                ? 0
                : event.key === "End"
                  ? filteredProjects.length - 1
                  : (selectedProject +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        filteredProjects.length) %
                    filteredProjects.length;
        setSelectedProject(next);
        window.requestAnimationFrame(() => projectRefs.current[next]?.focus());
    };

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

    useEffect(() => {
        const target = dropTargetRef.current;
        if (target === null) return;
        const allowDrop = (event: DragEvent): void => event.preventDefault();
        const openDroppedDirectory = (event: DragEvent): void => {
            event.preventDefault();
            const file = event.dataTransfer?.files.item(0);
            if (file === null || file === undefined) return;
            const path = Reflect.get(file, "path");
            if (typeof path === "string" && path.length > 0) onOpenRecent(path);
        };
        target.addEventListener("dragover", allowDrop);
        target.addEventListener("drop", openDroppedDirectory);
        return () => {
            target.removeEventListener("dragover", allowDrop);
            target.removeEventListener("drop", openDroppedDirectory);
        };
    }, [onOpenRecent]);

    return (
        <main
            aria-label="Welcome workspace"
            className={
                "welcomeWorkspace [background:var(--card)] [display:grid] [grid-column:1] [grid-row:2_/_-1] [grid-template-columns:224px_minmax(0,_1fr)] [height:100%] [min-height:0] [overflow:hidden]"
            }
            ref={dropTargetRef}
            style={{
                gridTemplateColumns: `${WELCOME_SIDEBAR_WIDTH}px minmax(0, 1fr)`,
            }}
        >
            <aside
                className={
                    "welcomeSidebar [background:var(--sidebar)] [border-right:1px_solid_var(--border)] [min-height:0] [position:relative]"
                }
                data-testid="welcome-sidebar"
                style={{ width: WELCOME_SIDEBAR_WIDTH }}
            >
                <div
                    className={
                        "welcomeBrand [align-items:center] [display:flex] [gap:10px] [height:64px] [padding:12px_16px_8px] [&>_span:last-child]:[display:flex] [&>_span:last-child]:[flex-direction:column] [&_strong]:[font-size:13px] [&_strong]:[font-weight:500] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:10px]"
                    }
                >
                    <a
                        aria-label="Copy About"
                        className={
                            "welcomeBrandMark [align-items:center] [background:var(--primary)] rounded-sm [color:var(--primary-foreground)] [display:flex] [height:31px] [justify-content:center] [width:31px]"
                        }
                        href="#copy-about"
                        onClick={(event) => {
                            event.preventDefault();
                            void writeClipboardText(
                                `Git Client ${PRODUCT_VERSION}`,
                            );
                        }}
                    >
                        <Icon name="branch" size={19} />
                    </a>
                    <span>
                        <strong>Git Client</strong>
                        <small>{PRODUCT_VERSION}</small>
                    </span>
                </div>
                <div
                    aria-label="Welcome screen categories"
                    className={
                        "welcomeNavigation [display:flex] [flex-direction:column] [gap:1px] [padding:20px_12px] [&>_button]:[background:transparent] [&>_button]:[height:32px] [&>_button]:[justify-content:flex-start] [&>_button]:[padding:0_23px] [&>_button]:[text-align:left] [&>_button:hover]:[background:color-mix(in_oklch,_var(--foreground)_5%,_transparent)] [&>_button[aria-current=page]]:[background:var(--sidebar-accent)] [&>_button:focus-visible]:[outline:2px_solid_var(--primary)] [&>_button:focus-visible]:[outline-offset:-2px]"
                    }
                    role="tree"
                >
                    {SECTIONS.map((item, index) => (
                        <Button
                            aria-current={section === item ? "page" : undefined}
                            aria-selected={section === item}
                            key={item}
                            onClick={() => setSection(item)}
                            onKeyDown={(event) =>
                                selectSectionFromKeyboard(event, index)
                            }
                            ref={(node) => {
                                navRefs.current[index] = node;
                            }}
                            role="treeitem"
                            style={{
                                width: WELCOME_NAV_ITEM_WIDTH,
                                height: WELCOME_NAV_ITEM_HEIGHT,
                            }}
                            type="button"
                            className={cn(
                                "gap-1.5 text-xs h-7 px-2.5 text-muted-foreground aria-selected:bg-accent aria-selected:text-foreground aria-current:bg-accent aria-current:text-foreground",
                            )}
                            variant="ghost"
                            size="sm"
                            tabIndex={-1}
                        >
                            {sectionLabel(item)}
                        </Button>
                    ))}
                </div>
                <Button
                    aria-label="Options Menu"
                    onClick={onOpenSettings}
                    type="button"
                    className="absolute bottom-3.5 left-3.5 size-7 p-0 text-muted-foreground"
                    variant="ghost"
                    size="icon-sm"
                >
                    <Icon name="settings" size={16} />
                </Button>
            </aside>

            {section === "projects" && recentProjects.length === 0 && (
                <section
                    aria-labelledby="welcome-title"
                    className={
                        "welcomeProjects [display:grid] [grid-template-rows:auto_auto_minmax(0,_1fr)] [min-height:0] [padding:104px_30px_34px] [position:relative] [&>_header]:[text-align:center] [&>_header_h1]:[font-size:27px] [&>_header_h1]:[line-height:1.2] [&>_header_h1]:[margin:0_0_20px] [&>_header_p]:[color:var(--muted-foreground)] [&>_header_p]:[font-size:13px] [&>_header_p]:[margin:0_0_7px] [&>_.welcomeProjectActions]:[margin-top:42px]"
                    }
                >
                    <header>
                        <h1 id="welcome-title">Welcome to Git Client</h1>
                        <p>Create a new project to start from scratch.</p>
                        <p>
                            Open existing project from disk or version control.
                        </p>
                    </header>
                    <div
                        aria-label="Project actions"
                        className={
                            "welcomeProjectActions [display:flex] [gap:56px] [justify-content:center] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[display:flex] [&>_button]:[flex-direction:column] [&>_button]:[font-size:13px] [&>_button]:[gap:12px] [&>_button]:[min-width:64px] [&>_button]:[padding:0] [&>_button>_span]:[align-items:center] [&>_button>_span]:[background:var(--muted)] [&>_button>_span]:rounded-sm [&>_button>_span]:[color:var(--primary)] [&>_button>_span]:[display:flex] [&>_button>_span]:[height:54px] [&>_button>_span]:[justify-content:center] [&>_button>_span]:[width:54px] [&>_button:hover>_span]:[background:var(--accent)]"
                        }
                    >
                        <Button
                            onClick={onNewProject}
                            type="button"
                            className="h-auto! min-h-0 border-0 p-0! hover:bg-transparent"
                            size="default"
                            variant="ghost"
                        >
                            <span>
                                <Icon name="plus" size={24} />
                            </span>
                            New Project
                        </Button>
                        <Button
                            onClick={onOpenRepository}
                            type="button"
                            className="h-auto! min-h-0 border-0 p-0! hover:bg-transparent"
                            size="default"
                            variant="ghost"
                        >
                            <span>
                                <Icon name="folder" size={24} />
                            </span>
                            Open
                        </Button>
                        <Button
                            onClick={onCloneRepository}
                            type="button"
                            className="h-auto! min-h-0 border-0 p-0! hover:bg-transparent"
                            size="default"
                            variant="ghost"
                        >
                            <span>
                                <Icon name="branch" size={24} />
                            </span>
                            Clone Repository
                        </Button>
                    </div>
                    <Button
                        className="mx-auto mt-5 h-7 px-3 text-xs text-muted-foreground"
                        onClick={onOpenSettings}
                        type="button"
                        variant="ghost"
                        size="sm"
                    >
                        More Actions
                    </Button>
                </section>
            )}

            {section === "projects" && recentProjects.length > 0 && (
                <section
                    aria-label="Projects"
                    className="min-h-0 overflow-auto bg-[var(--card)] px-[11px]"
                >
                    <div
                        className="flex h-[68px] items-center gap-2 border-b border-[var(--border)] pr-[10px]"
                        data-testid="welcome-project-toolbar"
                    >
                        <label className="flex min-w-0 flex-1 items-center gap-[9px] px-[9px] text-[var(--muted-foreground)]">
                            <Icon name="search" size={15} />
                            <span className="sr-only">Search projects</span>
                            <Input
                                className="h-8 min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
                                onChange={(event) => {
                                    setQuery(event.currentTarget.value);
                                    setSelectedProject(0);
                                }}
                                placeholder="Search projects"
                                value={query}
                            />
                        </label>
                        <Button
                            onClick={onNewProject}
                            type="button"
                            className={cn(
                                "h-7 px-2.5",
                                "h-7 w-[102px] rounded border-[var(--input)] bg-[var(--card)] px-[13px] text-[12px]",
                            )}
                            variant="outline"
                            size="sm"
                        >
                            New Project
                        </Button>
                        <Button
                            onClick={onOpenRepository}
                            type="button"
                            className={cn(
                                "h-7 px-2.5",
                                "h-7 w-[71px] rounded border-[var(--input)] bg-[var(--card)] px-[14px] text-[12px]",
                            )}
                            variant="outline"
                            size="sm"
                        >
                            Open
                        </Button>
                        <Button
                            onClick={onCloneRepository}
                            type="button"
                            className={cn(
                                "h-7 px-2.5",
                                "h-7 w-[133px] rounded border-[var(--input)] bg-[var(--card)] px-[13px] text-[12px]",
                            )}
                            variant="outline"
                            size="sm"
                        >
                            Clone Repository
                        </Button>
                    </div>
                    <div
                        aria-label="Recent Projects"
                        className="pt-[16px] outline-none"
                        onKeyDown={selectProjectFromKeyboard}
                        role="listbox"
                        tabIndex={-1}
                    >
                        {filteredProjects.map((project, index) => (
                            <div className="group relative" key={project.path}>
                                <Button
                                    aria-selected={selectedProject === index}
                                    onClick={() => setSelectedProject(index)}
                                    onDoubleClick={() =>
                                        onOpenRecent(project.path)
                                    }
                                    onFocus={() => setSelectedProject(index)}
                                    ref={(node) => {
                                        projectRefs.current[index] = node;
                                    }}
                                    role="option"
                                    aria-keyshortcuts="Enter"
                                    tabIndex={
                                        selectedProject === index ? 0 : -1
                                    }
                                    type="button"
                                    className={cn(
                                        "gap-1.5 text-xs min-h-[29px] w-full justify-start whitespace-normal px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                                        "flex min-h-[58px] w-full items-start gap-[13px] rounded px-[23px] py-[8px] pr-12 text-left hover:bg-[var(--muted)] focus-visible:bg-[var(--accent)]",
                                    )}
                                    variant="ghost"
                                    size="default"
                                >
                                    <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--project-avatar)] text-[9px] font-bold text-primary-foreground">
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
                                                <GitBranch
                                                    aria-hidden
                                                    size={12}
                                                    strokeWidth={1.5}
                                                />
                                                {project.branch}
                                            </small>
                                        )}
                                    </span>
                                </Button>
                                <Button
                                    aria-label={`More actions for ${project.name}`}
                                    className="absolute top-[15px] right-3 size-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    onClick={() => onOpenSettings()}
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                >
                                    <Icon name="more" size={15} />
                                </Button>
                            </div>
                        ))}
                        {filteredProjects.length === 0 && (
                            <p className="px-5 py-3 text-[var(--muted-foreground)]">
                                No projects found.
                            </p>
                        )}
                    </div>
                </section>
            )}

            {section === "customize" && (
                <section
                    aria-label="Customize"
                    className={
                        "welcomeCustomize [background:var(--card)] [min-height:0] [overflow:auto] [padding:30px_30px_18px]"
                    }
                >
                    <section>
                        <h1 className="m-0 mb-[18px] text-[16px] font-semibold leading-[20px]">
                            Appearance
                        </h1>
                        <div className="grid grid-cols-[59px_280px_minmax(0,1fr)] items-center gap-x-[10px] gap-y-[10px]">
                            <label
                                className="text-right text-[13px]"
                                htmlFor="welcome-theme"
                            >
                                Theme:
                            </label>
                            <Selector
                                className="rounded-sm bg-[var(--card)] text-[13px]"
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
