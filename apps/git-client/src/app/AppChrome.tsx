import { Button } from "@jongminchung/ui/components/button";
import { Spinner as SpinnerIcon } from "@jongminchung/ui/components/spinner";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { useCallback, useRef, useState } from "react";
import { dispatchWorkbenchEvent } from "../application/workbench-events/WorkbenchEventPort";
import { useCommands } from "../components/CommandProvider";
import { GitBranchesPopup } from "../components/GitBranchesPopup";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/ProductCollections";
import { ProjectSwitcherPopup } from "../components/ProjectSwitcherPopup";
import type { RepositoryToolKind } from "../components/RepositoryToolDialog";
import { WelcomeWorkspace } from "../components/WelcomeWorkspace";
import { type AppearancePreference } from "../domain/appearance";
import type { GitSessionController } from "../features/repository/session/useGitSessionController";

type GitSession = GitSessionController;

export function WorkspaceTitlebar({
    session,
    onActivateProject,
    onCloneProject,
    onOpenProject,
    onOpenRecentProject,
    onOpenPush,
    onOpenRepositoryTool,
    onOpenSettings,
    onProjectSwitcherOpenChange,
    onRemoveRecentProject,
    projectSwitcherOpen,
    readOnly,
    showRepositoryActions,
}: {
    readonly session: GitSession;
    readonly onActivateProject: (repositoryId: string) => Promise<void>;
    readonly onCloneProject: () => void;
    readonly onOpenProject: () => void;
    readonly onOpenRecentProject: (path: string) => Promise<void>;
    readonly onOpenPush: () => void;
    readonly onOpenRepositoryTool: (kind: RepositoryToolKind) => void;
    readonly onOpenSettings: () => void;
    readonly onProjectSwitcherOpenChange: (open: boolean) => void;
    readonly onRemoveRecentProject: (path: string) => void;
    readonly projectSwitcherOpen: boolean;
    readonly readOnly: boolean;
    readonly showRepositoryActions: boolean;
}) {
    const { openPalette } = useCommands();
    const { repository, remotes } = session.repository;
    const { compareBranches } = session.queries;
    const { executeOperation } = session.mutations;
    const { openRepositories, recentProjects } = session.workspace;
    const projectButton = useRef<HTMLButtonElement>(null);
    const [branchesOpen, setBranchesOpen] = useState(false);
    const closeProjectSwitcher = useCallback((): void => {
        onProjectSwitcherOpenChange(false);
        window.requestAnimationFrame(() => projectButton.current?.focus());
    }, [onProjectSwitcherOpenChange]);
    return (
        <header
            className={`titlebar [align-items:center] [background:var(--card)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:2px] [padding-right:5px] [user-select:none] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[color:var(--muted-foreground)] [&>_button]:[display:flex] [&>_button]:[height:26px] [&>_button]:[justify-content:center] [&>_button:hover]:[background:var(--muted)] [&>_button:hover]:[color:var(--foreground)] bg-background! border-transparent! [html[data-toolbar-visible=false]_&>*:not(.trafficSpace):not(.mainToolbarDragRegion)]:hidden! [html[data-distraction-free-mode=true]_&>*:not(.trafficSpace):not(.mainToolbarDragRegion)]:hidden! [html[data-presentation-mode=true]_&>*:not(.trafficSpace):not(.mainToolbarDragRegion)]:hidden! titlebar`}
            aria-label="Main Toolbar"
        >
            <div
                className={`trafficSpace [flex:0_0_74px] max-[1050px]:[flex-basis:64px] trafficSpace`}
            />
            <div
                className={`mainToolbarPopupAnchor [align-self:stretch] [display:flex] [position:relative] mainToolbarPopupAnchor`}
            >
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-expanded={projectSwitcherOpen}
                                aria-label={`Project: ${repository?.snapshot.name ?? "Git Client"}`}
                                className="h-[26px] max-w-[210px] gap-[5px] px-1.5 text-xs text-muted-foreground [&>span:nth-child(2)]:overflow-hidden [&>span:nth-child(2)]:text-ellipsis [&>span:nth-child(2)]:whitespace-nowrap"
                                onClick={() =>
                                    onProjectSwitcherOpenChange(
                                        !projectSwitcherOpen,
                                    )
                                }
                                ref={projectButton}
                                variant="ghost"
                                size="default"
                            >
                                <span
                                    className={`projectMark [align-items:center] [background:var(--primary)] rounded-xs [color:var(--primary-foreground)] [display:inline-flex] [font-size:9px] [font-weight:700] [height:16px] [justify-content:center] [width:16px] projectMark rounded-xs`}
                                >
                                    {repository?.snapshot.name
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase() || "G"}
                                </span>
                                <span>
                                    {repository?.snapshot.name ?? "Git Client"}
                                </span>
                                <Icon name="chevron" size={10} />
                            </Button>
                        }
                    />
                    <TooltipContent>
                        {repository?.snapshot.path ?? "Projects"}
                    </TooltipContent>
                </Tooltip>
                {projectSwitcherOpen && repository && (
                    <ProjectSwitcherPopup
                        activeRepositoryId={repository.snapshot.id}
                        onActivate={onActivateProject}
                        onClone={onCloneProject}
                        onClose={closeProjectSwitcher}
                        onOpen={onOpenProject}
                        onOpenRecent={onOpenRecentProject}
                        onRemoveRecent={onRemoveRecentProject}
                        openRepositories={openRepositories}
                        recentProjects={recentProjects}
                    />
                )}
            </div>
            {showRepositoryActions && (
                <>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Update Project..."
                                    className="h-[26px] w-7 text-xs text-muted-foreground"
                                    disabled={!repository || readOnly}
                                    onClick={() =>
                                        void executeOperation({
                                            kind: "pull",
                                            rebase: false,
                                        })
                                    }
                                    variant="ghost"
                                    size="default"
                                >
                                    <Icon name="pull" size={15} />
                                </Button>
                            }
                        />
                        <TooltipContent>Update Project...</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Push…"
                                    className="h-[26px] w-7 text-xs text-muted-foreground"
                                    disabled={!repository || readOnly}
                                    onClick={onOpenPush}
                                    variant="ghost"
                                    size="default"
                                >
                                    <Icon name="push" size={15} />
                                </Button>
                            }
                        />
                        <TooltipContent>Push…</TooltipContent>
                    </Tooltip>
                    <div
                        className={`mainToolbarPopupAnchor [align-self:stretch] [display:flex] [position:relative] mainToolbarPopupAnchor`}
                    >
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <Button
                                        aria-expanded={branchesOpen}
                                        aria-label={
                                            repository?.snapshot
                                                .currentBranch ?? "No branch"
                                        }
                                        className="h-[26px] max-w-[180px] gap-[5px] px-1.5 text-xs text-muted-foreground [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap"
                                        disabled={!repository || readOnly}
                                        onClick={() =>
                                            setBranchesOpen((value) => !value)
                                        }
                                        variant="ghost"
                                        size="default"
                                    >
                                        <Icon name="branch" size={14} />
                                        <span>
                                            {repository?.snapshot
                                                .currentBranch ?? "No branch"}
                                        </span>
                                        <Icon name="chevron" size={10} />
                                    </Button>
                                }
                            />
                            <TooltipContent>{`Git Branch: ${repository?.snapshot.currentBranch ?? "No branch"}`}</TooltipContent>
                        </Tooltip>
                        {branchesOpen && repository && (
                            <GitBranchesPopup
                                currentBranch={
                                    repository.snapshot.currentBranch
                                }
                                onCheckout={(target) =>
                                    executeOperation({
                                        kind: "checkout",
                                        target,
                                        force: false,
                                    })
                                }
                                onCompare={compareBranches}
                                onCommit={() =>
                                    dispatchWorkbenchEvent(
                                        "git-client:repository-view-request",
                                        "changes",
                                    )
                                }
                                onOperation={executeOperation}
                                onClose={() => setBranchesOpen(false)}
                                onOpenSettings={() => {
                                    setBranchesOpen(false);
                                    onOpenRepositoryTool("refs");
                                }}
                                refs={repository.refs}
                                remotes={remotes}
                            />
                        )}
                    </div>
                </>
            )}
            {readOnly && (
                <span
                    aria-label="Safe Mode"
                    className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    role="status"
                >
                    Safe Mode
                </span>
            )}
            <span
                className={`mainToolbarDragRegion [flex:1] [height:100%] mainToolbarDragRegion`}
            />
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            aria-label="Search Everywhere"
                            className="h-[26px] w-7 text-xs text-muted-foreground"
                            onClick={openPalette}
                            variant="ghost"
                            size="default"
                        >
                            <Icon name="search" size={14} />
                        </Button>
                    }
                />
                <TooltipContent>Search Everywhere</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            aria-label="IDE and Project Settings"
                            className="h-[26px] w-7 text-xs text-muted-foreground"
                            onClick={onOpenSettings}
                            variant="ghost"
                            size="default"
                        >
                            <Icon name="settings" size={14} />
                        </Button>
                    }
                />
                <TooltipContent>IDE and Project Settings</TooltipContent>
            </Tooltip>
        </header>
    );
}

export function WelcomeTitlebar() {
    return (
        <header
            className={
                "welcomeTitlebar [align-items:center] [background:var(--card)] [border-bottom:1px_solid_var(--border)] [display:flex] [font-weight:600] [grid-row:1] [height:30px] [padding-left:84px] [user-select:none]"
            }
            data-testid="welcome-titlebar"
        >
            Welcome to Git Client
        </header>
    );
}

export function StartupWorkspace({
    session,
    onCloneRepository,
    onNewProject,
    onOpenRepository,
    onOpenSettings,
    appearancePreference,
    onAppearancePreferenceChange,
}: {
    readonly session: GitSession;
    readonly onCloneRepository: () => void;
    readonly onNewProject: () => void;
    readonly onOpenRepository: () => void;
    readonly onOpenSettings: () => void;
    readonly appearancePreference: AppearancePreference;
    readonly onAppearancePreferenceChange: (
        preference: AppearancePreference,
    ) => void;
}) {
    const { openRepository, recentProjects, restoring } = session.workspace;
    if (restoring) {
        return (
            <main
                className={`startupWorkspace [grid-row:2_/_-1] [min-height:0] [background:var(--card)] [display:grid] [grid-template-rows:auto_minmax(0,_1fr)] [overflow:hidden] startupWorkspace`}
                aria-busy="true"
            >
                <EmptyState
                    className="p-0 [grid-row:1_/_-1] [&_[data-slot=empty-title]]:font-medium [&_[data-slot=empty-title]]:text-foreground"
                    description="Reopening repositories and validating saved paths."
                    icon={<SpinnerIcon aria-hidden className="size-3" />}
                    role="status"
                    title="Restoring workspace…"
                />
            </main>
        );
    }
    return (
        <WelcomeWorkspace
            appearancePreference={appearancePreference}
            onAppearancePreferenceChange={onAppearancePreferenceChange}
            onCloneRepository={onCloneRepository}
            onNewProject={onNewProject}
            onOpenRecent={(path) => void openRepository(path)}
            onOpenRepository={onOpenRepository}
            onOpenSettings={onOpenSettings}
            recentProjects={recentProjects}
        />
    );
}
