import { Button } from "@jongminchung/ui/components/button";
import { Toggle } from "@jongminchung/ui/components/toggle";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import { useCommands } from "../../../components/CommandProvider";
import { Icon } from "../../../components/Icon";
import { Spinner } from "../../../components/ProductCollections";
import { type RepositoryViewMode } from "../../../domain/changeReview";

export function RepositoryToolStripe({
    changes,
    mode,
    onModeChange,
    onOpenProject,
    onOpenGitConsole,
    projectOpen,
    bookmarksOpen,
    onOpenBookmarks,
    terminalFocused,
    disabled = false,
    readOnly = false,
}: {
    readonly changes: number;
    readonly mode: RepositoryViewMode;
    readonly onModeChange: (mode: RepositoryViewMode) => void;
    readonly onOpenProject: () => void;
    readonly onOpenGitConsole: () => void;
    readonly projectOpen: boolean;
    readonly bookmarksOpen: boolean;
    readonly onOpenBookmarks: () => void;
    readonly terminalFocused: boolean;
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
}) {
    const { openPalette } = useCommands();
    return (
        <nav
            aria-label="Left Toolbar"
            className={`toolStripe bg-background! border-transparent! [html[data-compact=true]_&_button]:min-h-6 [html[data-tool-window-bars-visible=false]_&]:hidden! [html[data-distraction-free-mode=true]_&]:hidden! [html[data-presentation-mode=true]_&]:hidden! [background:var(--card)] [border-right:1px_solid_var(--border)] [display:flex] [flex-direction:column] [justify-content:space-between] [min-height:0] [padding:3px_0] [&>_div]:[display:flex] [&>_div]:[flex-direction:column] [&_button_em]:[align-items:center] [&_button_em]:[background:var(--primary)] [&_button_em]:rounded-lg [&_button_em]:[color:var(--primary-foreground)] [&_button_em]:[display:flex] [&_button_em]:[font-size:8px] [&_button_em]:[font-style:normal] [&_button_em]:[height:13px] [&_button_em]:[justify-content:center] [&_button_em]:[min-width:13px] [&_button_em]:[position:absolute] [&_button_em]:[right:1px] [&_button_em]:[top:1px] toolStripe [&_button_em]:rounded-lg`}
        >
            <div>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Toggle
                                aria-label="Project"
                                className="group/toggle relative inline-flex h-[31px] w-[30px] shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground outline-none transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pressed:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0"
                                data-slot="toggle"
                                disabled={disabled}
                                onPressedChange={onOpenProject}
                                pressed={projectOpen}
                            >
                                <Icon name="folder" size={17} />
                            </Toggle>
                        }
                    />
                    <TooltipContent>Project</TooltipContent>
                </Tooltip>
                {bookmarksOpen && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Toggle
                                    aria-label="Bookmarks"
                                    className="group/toggle relative inline-flex h-[31px] w-[30px] shrink-0 items-center justify-center rounded-md bg-transparent text-primary outline-none transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pressed:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0"
                                    data-slot="toggle"
                                    disabled={disabled}
                                    onPressedChange={onOpenBookmarks}
                                    pressed
                                >
                                    <Icon name="bookmark" size={17} />
                                </Toggle>
                            }
                        />
                        <TooltipContent>Bookmarks</TooltipContent>
                    </Tooltip>
                )}
                {!terminalFocused && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Toggle
                                    aria-label="Commit"
                                    className="group/toggle relative inline-flex h-[31px] w-[30px] shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground outline-none transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pressed:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0"
                                    data-slot="toggle"
                                    disabled={disabled || readOnly}
                                    onPressedChange={() =>
                                        onModeChange("changes")
                                    }
                                    pressed={mode === "changes"}
                                >
                                    <Icon name="changes" size={17} />
                                    {changes > 0 && <em>{changes}</em>}
                                </Toggle>
                            }
                        />
                        <TooltipContent>Commit</TooltipContent>
                    </Tooltip>
                )}
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="More"
                                className={cn(
                                    "relative h-[31px] w-[30px] text-xs text-muted-foreground",
                                )}
                                disabled={disabled}
                                onClick={openPalette}
                                variant="ghost"
                                size="default"
                            >
                                <Icon name="more" size={17} />
                            </Button>
                        }
                    />
                    <TooltipContent>More Tool Windows</TooltipContent>
                </Tooltip>
            </div>
            <div>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Toggle
                                aria-label="Terminal"
                                className="group/toggle relative inline-flex h-[31px] w-[30px] shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground outline-none transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pressed:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0"
                                data-slot="toggle"
                                disabled={disabled || readOnly}
                                onPressedChange={() =>
                                    dispatchWorkbenchEvent(
                                        "git-client:open-terminal",
                                        undefined,
                                    )
                                }
                                pressed={terminalFocused}
                            >
                                <Icon name="console" size={17} />
                            </Toggle>
                        }
                    />
                    <TooltipContent>Terminal</TooltipContent>
                </Tooltip>
                {!terminalFocused && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Git"
                                    className={cn(
                                        "relative h-[31px] w-[30px] text-xs text-muted-foreground",
                                    )}
                                    disabled={disabled}
                                    onClick={onOpenGitConsole}
                                    variant="ghost"
                                    size="default"
                                >
                                    <Icon name="branch" size={17} />
                                </Button>
                            }
                        />
                        <TooltipContent>Git</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </nav>
    );
}

export function RepositoryRightToolStripe({
    notificationCount = 0,
    notificationsOpen = false,
    onToggleNotifications,
}: {
    readonly notificationCount?: number;
    readonly notificationsOpen?: boolean;
    readonly onToggleNotifications?: () => void;
} = {}) {
    return (
        <nav
            aria-label="Right Toolbar"
            className={`rightToolStripe bg-background! border-transparent! [html[data-compact=true]_&_button]:min-h-6 [html[data-tool-window-bars-visible=false]_&]:hidden! [html[data-distraction-free-mode=true]_&]:hidden! [html[data-presentation-mode=true]_&]:hidden! [background:var(--card)] [border-left:1px_solid_var(--border)] [min-height:0] [padding:3px_0] [&_button_em]:[background:var(--primary)] [&_button_em]:rounded-full [&_button_em]:[display:block] [&_button_em]:[height:7px] [&_button_em]:[position:absolute] [&_button_em]:[right:3px] [&_button_em]:[top:2px] [&_button_em]:[width:7px] rightToolStripe [&_button_em]:rounded-full`}
        >
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Toggle
                            aria-label="Notifications"
                            className="group/toggle relative inline-flex h-[31px] w-[30px] shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground outline-none transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pressed:bg-accent data-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
                            data-slot="toggle"
                            disabled={!onToggleNotifications}
                            onPressedChange={onToggleNotifications}
                            pressed={notificationsOpen}
                        >
                            <Icon name="warning" size={15} />
                            {notificationCount > 0 && <em aria-hidden="true" />}
                        </Toggle>
                    }
                />
                <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            aria-label="More"
                            className={cn(
                                "relative h-[31px] w-[30px] text-xs text-muted-foreground disabled:opacity-100",
                            )}
                            disabled
                            variant="ghost"
                            size="default"
                        >
                            <Icon name="more" size={15} />
                        </Button>
                    }
                />
                <TooltipContent>More Tool Windows</TooltipContent>
            </Tooltip>
        </nav>
    );
}

export function RepositoryLoadingSkeleton(): React.ReactElement {
    return (
        <div
            className={`workbench [display:grid] [grid-template-columns:39px_minmax(0,_1fr)_35px] [height:100%] [min-height:0] [min-width:0] [html[data-tool-window-bars-visible=false]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-distraction-free-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! [html[data-presentation-mode=true]_&]:grid-cols-[0_minmax(0,1fr)_0]! workbench`}
            role="status"
        >
            <RepositoryToolStripe
                bookmarksOpen={false}
                changes={0}
                mode="history"
                onModeChange={() => undefined}
                onOpenBookmarks={() => undefined}
                onOpenGitConsole={() => undefined}
                onOpenProject={() => undefined}
                projectOpen={false}
                terminalFocused={false}
                disabled
            />
            <div
                className={`workbenchSurface [background:var(--background)] [display:grid] [grid-template-rows:minmax(0,_1fr)_auto] [min-height:0] [min-width:0] workbenchSurface`}
            >
                <div
                    className={`workbenchContent [display:grid] [gap:3px] [grid-template-columns:minmax(0,_1fr)] [min-height:0] [min-width:0] [html[data-distraction-free-mode=true]_&]:grid-cols-[minmax(0,1fr)]! [html[data-presentation-mode=true]_&]:grid-cols-[minmax(0,1fr)]! workbenchContent`}
                >
                    <div
                        className={`activeWorkspace [background:var(--card)] rounded-lg [display:grid] [min-height:0] [min-width:0] [overflow:hidden] [padding-top:32px] [position:relative] activeWorkspace rounded-lg`}
                    >
                        <div
                            aria-label="Log"
                            className={`loadingEditorTabs [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [height:32px] [left:0] [padding:0_5px] [position:absolute] [right:0] [top:0] [&>_span]:[align-items:center] [&>_span]:[background:var(--accent)] [&>_span]:rounded-sm [&>_span]:[color:var(--foreground)] [&>_span]:[display:flex] [&>_span]:[gap:5px] [&>_span]:[height:29px] [&>_span]:[padding:0_8px] loadingEditorTabs [&>_span]:rounded-sm`}
                            role="tablist"
                        >
                            <span aria-hidden="true">
                                <Icon name="branch" size={14} />
                                Log
                            </span>
                        </div>
                        <Spinner
                            className="h-full w-full justify-center"
                            label="Loading VCS Log…"
                        />
                    </div>
                </div>
            </div>
            <RepositoryRightToolStripe />
        </div>
    );
}
