import { Button } from "@jongminchung/ui/components/button";
import { TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import type { CSSProperties } from "react";
import type { useAppDialog } from "../../components/AppDialog";
import { Icon } from "../../components/Icon";
import { StatePill } from "../../components/ProductCollections";
import { toVoidHandler } from "../../domain/toVoidHandler";
import type { RepositoryView } from "../../domain/types";
import type { GitSessionController } from "../../git-session/useGitSessionController";
import {
    editorPanelDomId,
    editorTabDomId,
} from "../hooks/useRepositoryTabCoordinator";
import type { RepositoryWorkspaceStore } from "../state/repositoryWorkspaceStore";
import { inspectorKey, type InspectorState } from "../state/workspaceTypes";

interface RepositoryEditorTabsProps {
    readonly abortInProgressOperation: () => Promise<void>;
    readonly closeInspectorEditorTab: (key: string) => Promise<void>;
    readonly closeLogTab: (tabId: string) => void;
    readonly dialog: ReturnType<typeof useAppDialog>;
    readonly dirtyInspectorKeys: ReadonlySet<string>;
    readonly editorTabsId: string;
    readonly hasInspector: boolean;
    readonly inspectorTabs: readonly InspectorState[];
    readonly leftToolWindowOpen: boolean;
    readonly logOpen: boolean;
    readonly logTabIds: readonly string[];
    readonly pinnedInspectorKeys: ReadonlySet<string>;
    readonly previewInspectorKey: string | undefined;
    readonly repository: RepositoryView;
    readonly repositoryViewMode: RepositoryWorkspaceStore["repositoryViewMode"];
    readonly sessionExecuteOperation: GitSessionController["mutations"]["executeOperation"];
    readonly sessionLoading: boolean;
    readonly sessionReload: GitSessionController["queries"]["reload"];
    readonly sessionStale: boolean;
    readonly sideToolWindowWidth: number;
}

export function RepositoryEditorTabs({
    abortInProgressOperation,
    closeInspectorEditorTab,
    closeLogTab,
    dialog,
    dirtyInspectorKeys,
    editorTabsId,
    hasInspector,
    inspectorTabs,
    leftToolWindowOpen,
    logOpen,
    logTabIds,
    pinnedInspectorKeys,
    previewInspectorKey,
    repository,
    repositoryViewMode,
    sessionExecuteOperation,
    sessionLoading,
    sessionReload,
    sessionStale,
    sideToolWindowWidth,
}: RepositoryEditorTabsProps) {
    const inspector = hasInspector;
    return (
        <div
            className={`commandbar [html[data-tool-window-bars-visible=false]_&]:left-0! [html[data-tool-window-bars-visible=false]_&]:right-0! [html[data-distraction-free-mode=true]_&]:hidden! [html[data-presentation-mode=true]_&]:hidden! [html[data-navigation-bar=top]_&]:top-[59px]! [align-items:center] [background:var(--card)] [border-bottom:1px_solid_var(--border)] rounded-t-lg rounded-b-none [display:flex] [gap:3px] [height:32px] [left:var(--editor-left,_39px)] [padding:0_5px_0_0] [position:absolute] [right:35px] [top:35px] [z-index:8] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[display:flex] [&>_button]:[gap:6px] [&>_button]:[height:30px] [&>_button]:[padding:0_7px] [&>_button:hover]:[background:var(--muted)] [&>_button_>_em]:[align-items:center] [&>_button_>_em]:[background:var(--primary)] [&>_button_>_em]:rounded-lg [&>_button_>_em]:[color:var(--primary-foreground)] [&>_button_>_em]:[display:inline-flex] [&>_button_>_em]:[font-size:9px] [&>_button_>_em]:[font-style:normal] [&>_button_>_em]:[height:15px] [&>_button_>_em]:[justify-content:center] [&>_button_>_em]:[min-width:15px] [&>_button_>_em]:[padding:0_4px] commandbar rounded-t-lg rounded-b-none [&>_button_>_em]:rounded-lg`}
            style={
                {
                    "--editor-left":
                        leftToolWindowOpen && !sessionLoading
                            ? `${(repositoryViewMode === "changes" ? 302 : sideToolWindowWidth) + 42}px`
                            : "39px",
                } as CSSProperties
            }
        >
            <TabsList
                render={
                    <nav
                        aria-label={!inspector ? "Log" : "Editor tabs"}
                        className={`editorTabs [align-items:center] [align-self:stretch] [display:flex] [&_button[aria-current=page]]:rounded-sm [&_button[aria-current=page]]:bg-muted! [&_button[aria-current=page]]:text-foreground! [&_button[aria-current=page]]:shadow-[inset_0_0_0_1px_var(--input)]! [&_button:hover:not([aria-current=page])]:rounded-sm [&_button:hover:not([aria-current=page])]:bg-overlay-hover editorTabs`}
                    />
                }
            >
                {logOpen &&
                    logTabIds.map((tabId, index) => {
                        const label = index === 0 ? "Log" : `Log ${index + 1}`;
                        const value = `log:${tabId}`;
                        return (
                            <span
                                className={cn(
                                    "group",
                                    `workspaceTab [display:inline-flex] [flex:0_0_auto] [&_em]:[color:var(--destructive)] [&_em]:[font-size:15px] [&_em]:[font-style:normal] [&_em]:[line-height:1] data-[preview=true]:[&>button:first-child]:italic data-[pinned=true]:[&>button:first-child]:after:size-1 data-[pinned=true]:[&>button:first-child]:after:rounded-full data-[pinned=true]:[&>button:first-child]:after:bg-current data-[pinned=true]:[&>button:first-child]:after:opacity-55 data-[pinned=true]:[&>button:first-child]:after:content-[""] workspaceTab`,
                                )}
                                key={tabId}
                                role="presentation"
                            >
                                <Tooltip>
                                    <TooltipTrigger
                                        render={
                                            <TabsTrigger
                                                aria-controls={editorPanelDomId(
                                                    editorTabsId,
                                                    value,
                                                )}
                                                aria-keyshortcuts="Delete"
                                                aria-label={label}
                                                id={editorTabDomId(
                                                    editorTabsId,
                                                    value,
                                                )}
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key !==
                                                            "Delete" &&
                                                        event.key !==
                                                            "Backspace"
                                                    )
                                                        return;
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    closeLogTab(tabId);
                                                }}
                                                render={
                                                    <Button
                                                        className="h-[32px]! max-w-[210px] gap-1! overflow-hidden px-2! py-0! text-xs! text-ellipsis text-muted-foreground data-active:bg-accent data-active:text-foreground"
                                                        variant="ghost"
                                                        size="xs"
                                                    />
                                                }
                                                value={value}
                                            >
                                                <Icon name="branch" size={14} />
                                                <span className="truncate">
                                                    {label}
                                                </span>
                                                <span
                                                    aria-hidden="true"
                                                    className="inline-flex h-6 shrink-0 items-center justify-center rounded-md px-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                                                    data-close-tab={value}
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        closeLogTab(tabId);
                                                    }}
                                                    onPointerDown={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                    }}
                                                >
                                                    <Icon
                                                        name="close"
                                                        size={10}
                                                    />
                                                </span>
                                            </TabsTrigger>
                                        }
                                    />
                                    <TooltipContent>{`${label} · Delete to close`}</TooltipContent>
                                </Tooltip>
                            </span>
                        );
                    })}
                {inspectorTabs.map((tab) => {
                    const key = inspectorKey(tab);
                    const label = tab.path?.split("/").at(-1) ?? "Repository";
                    const value = `inspector:${key}`;
                    return (
                        <span
                            className={cn(
                                "group",
                                `workspaceTab [display:inline-flex] [flex:0_0_auto] [&_em]:[color:var(--destructive)] [&_em]:[font-size:15px] [&_em]:[font-style:normal] [&_em]:[line-height:1] data-[preview=true]:[&>button:first-child]:italic data-[pinned=true]:[&>button:first-child]:after:size-1 data-[pinned=true]:[&>button:first-child]:after:rounded-full data-[pinned=true]:[&>button:first-child]:after:bg-current data-[pinned=true]:[&>button:first-child]:after:opacity-55 data-[pinned=true]:[&>button:first-child]:after:content-[""] workspaceTab`,
                            )}
                            data-pinned={pinnedInspectorKeys.has(key)}
                            data-preview={previewInspectorKey === key}
                            key={key}
                            role="presentation"
                        >
                            <Tooltip>
                                <TooltipTrigger
                                    render={
                                        <TabsTrigger
                                            aria-controls={editorPanelDomId(
                                                editorTabsId,
                                                value,
                                            )}
                                            aria-keyshortcuts="Delete"
                                            aria-label={`Editor ${tab.path ?? "Repository"}`}
                                            id={editorTabDomId(
                                                editorTabsId,
                                                value,
                                            )}
                                            onKeyDown={(event) => {
                                                if (
                                                    event.key !== "Delete" &&
                                                    event.key !== "Backspace"
                                                )
                                                    return;
                                                event.preventDefault();
                                                event.stopPropagation();
                                                void closeInspectorEditorTab(
                                                    key,
                                                );
                                            }}
                                            render={
                                                <Button
                                                    className={cn(
                                                        "h-[32px]! max-w-[210px] gap-1! overflow-hidden px-2! py-0! text-xs! text-ellipsis text-muted-foreground data-active:bg-accent data-active:text-foreground",
                                                    )}
                                                    variant="ghost"
                                                    size="xs"
                                                />
                                            }
                                            value={value}
                                        >
                                            <Icon
                                                name={
                                                    tab.tab === "tree"
                                                        ? "folder"
                                                        : "file"
                                                }
                                                size={14}
                                            />
                                            <span className="truncate">
                                                {label}
                                            </span>
                                            {dirtyInspectorKeys.has(key) && (
                                                <span aria-label="Modified">
                                                    *
                                                </span>
                                            )}
                                            <span
                                                aria-hidden="true"
                                                className="inline-flex h-6 shrink-0 items-center justify-center rounded-md px-1 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                                                data-close-tab={value}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    void closeInspectorEditorTab(
                                                        key,
                                                    );
                                                }}
                                                onPointerDown={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                }}
                                            >
                                                <Icon name="close" size={10} />
                                            </span>
                                        </TabsTrigger>
                                    }
                                />
                                <TooltipContent>{`${tab.path ?? "Repository"} · Delete to close`}</TooltipContent>
                            </Tooltip>
                        </span>
                    );
                })}
            </TabsList>
            <span
                className={`editorToolbarSpacer [flex:1] editorToolbarSpacer`}
            />
            {sessionStale && <StatePill>Changed</StatePill>}
            {repository.snapshot.isShallow && <StatePill>Shallow</StatePill>}
            {repository.snapshot.isBare && <StatePill>Bare</StatePill>}
            {repository.snapshot.operation && (
                <StatePill className="gap-1" tone="destructive">
                    <Icon name="warning" size={13} />
                    {repository.snapshot.operation} in progress
                </StatePill>
            )}
            {repository.snapshot.operation &&
                repository.snapshot.operation !== "bisect" && (
                    <>
                        <Button
                            className={cn("h-6 px-2 text-xs")}
                            onClick={() =>
                                void sessionExecuteOperation({
                                    kind: "continue",
                                    operation: repository.snapshot.operation as
                                        | "merge"
                                        | "rebase"
                                        | "cherryPick"
                                        | "revert",
                                })
                            }
                            variant="secondary"
                            size="xs"
                        >
                            Continue
                        </Button>
                        {(repository.snapshot.operation === "rebase" ||
                            repository.snapshot.operation === "cherryPick") && (
                            <Button
                                className={cn("h-6 px-2 text-xs")}
                                onClick={() =>
                                    void sessionExecuteOperation({
                                        kind: "skip",
                                        operation: repository.snapshot
                                            .operation as
                                            | "rebase"
                                            | "cherryPick",
                                    })
                                }
                                variant="secondary"
                                size="xs"
                            >
                                Skip
                            </Button>
                        )}
                        <Button
                            className={cn(
                                "h-6 border-destructive px-2 text-xs shadow-xs",
                            )}
                            onClick={toVoidHandler(async () => {
                                const accepted = await dialog.confirm({
                                    title: `Abort ${repository.snapshot.operation}?`,
                                    description:
                                        "Restores the state recorded before the in-progress Git operation.",
                                    confirmLabel: "Abort operation",
                                    dangerous: true,
                                });
                                if (
                                    accepted &&
                                    repository.snapshot.operation &&
                                    repository.snapshot.operation !== "bisect"
                                ) {
                                    await abortInProgressOperation();
                                }
                            })}
                            variant="destructive"
                            size="xs"
                        >
                            Abort
                        </Button>
                    </>
                )}
            <Tooltip>
                <TooltipTrigger
                    render={
                        <Button
                            aria-label="View Options"
                            className="h-6 w-[30px] flex-[0_0_30px] rounded-none border-y-0 border-r border-l-0 bg-transparent p-0 text-xs text-muted-foreground hover:text-accent-foreground"
                            onClick={() => void sessionReload()}
                            variant="outline"
                            size="xs"
                        >
                            <Icon name="more" size={16} />
                        </Button>
                    }
                />
                <TooltipContent>View Options</TooltipContent>
            </Tooltip>
        </div>
    );
}
