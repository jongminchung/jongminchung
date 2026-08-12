import {
    memo,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
} from "react";
import type { GitConsoleEntry } from "../domain/gitConsole";
import type { ProjectSearchResult } from "../domain/projectSearch";
import type { FileChange, StashEntry, StatusModel } from "../domain/types";
import {
    DEFAULT_BOTTOM_PANEL_HEIGHT,
    MAX_BOTTOM_PANEL_HEIGHT,
    MIN_BOTTOM_PANEL_HEIGHT,
} from "../domain/workspacePersistence";
import type {
    GitLocalHistoryActivitiesPage,
    GitLocalHistoryActivity,
    GitLocalHistoryActivityDetail,
    GitLocalHistoryScope,
} from "../shared/contracts/git-utility";
import type {
    GitOperation,
    RecoveryEntry,
    ShelfEntry,
} from "../shared/contracts/model";
import { useAppDialog } from "./AppDialog";
import { BottomPanelTabs } from "./bottom-panel/BottomPanelTabs";
import type { BottomPanelTab } from "./bottom-panel/bottomPanelTypes";
import { RecoverySurface } from "./bottom-panel/RecoverySurface";
import { ShelfSurface } from "./bottom-panel/ShelfSurface";
import { StashSurface } from "./bottom-panel/StashSurface";
import { useBottomPanelLifecycle } from "./bottom-panel/useBottomPanelLifecycle";
import { useStashController } from "./bottom-panel/useStashController";
import { FindResultsPanel, type FindResultsSession } from "./FindResultsPanel";
import { GitConsolePanel } from "./GitConsolePanel";
import { LocalHistoryPanel } from "./LocalHistoryPanel";
import { TerminalPanel } from "./TerminalPanel";

export type { BottomPanelTab } from "./bottom-panel/bottomPanelTypes";

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
    readonly onLoadLocalHistoryDiff: (
        activityId: string,
        path: string,
    ) => Promise<string>;
    readonly onRevertLocalHistory: (
        activityId: string,
        paths: readonly string[],
        includeLater: boolean,
    ) => Promise<void>;
    readonly onCreateLocalHistoryPatch: (
        activityId: string,
        paths: readonly string[],
    ) => Promise<string>;
    readonly onPutLocalHistoryLabel: (
        label: string,
    ) => Promise<GitLocalHistoryActivity>;
    readonly findResults: FindResultsSession | null;
    readonly onOpenFindResult: (result: ProjectSearchResult) => void;
    readonly onSearchAgain: () => void;
    readonly onOpenStashDiff: (stash: StashEntry) => void;
    readonly onLoadStashFiles: (
        stash: StashEntry,
    ) => Promise<readonly FileChange[]>;
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
    const dialog = useAppDialog();
    const stash = useStashController({
        dialog,
        onLoadFiles: onLoadStashFiles,
        onOperation,
    });
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
    }, [dialog, onCreateShelf, status.changes]);
    const lifecycle = useBottomPanelLifecycle({
        active,
        collapsed,
        onActiveChange,
        onShelveChanges: shelveChanges,
        onStashChanges: stash.stashChanges,
        onToggle,
        recoveryCount: recoveryEntries.length,
        shelfCount: shelves.length,
        stashCount: stashes.length,
    });
    const resizePanel = (event: ReactPointerEvent<HTMLDivElement>): void => {
        event.preventDefault();
        const startY = event.clientY;
        const startHeight = height;
        const move = (pointerEvent: PointerEvent): void => {
            onHeightChange(
                Math.min(
                    MAX_BOTTOM_PANEL_HEIGHT,
                    Math.max(
                        MIN_BOTTOM_PANEL_HEIGHT,
                        startHeight + startY - pointerEvent.clientY,
                    ),
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
    const resizePanelWithKeyboard = (
        event: ReactKeyboardEvent<HTMLDivElement>,
    ): void => {
        if (event.key === "Home") onHeightChange(MIN_BOTTOM_PANEL_HEIGHT);
        else if (event.key === "End") onHeightChange(MAX_BOTTOM_PANEL_HEIGHT);
        else if (event.key === "ArrowUp")
            onHeightChange(Math.min(MAX_BOTTOM_PANEL_HEIGHT, height + 10));
        else if (event.key === "ArrowDown")
            onHeightChange(Math.max(MIN_BOTTOM_PANEL_HEIGHT, height - 10));
        else return;
        event.preventDefault();
    };

    return (
        <section
            aria-label={`${active} Tool Window`}
            className={`${`bottomPanel [background:var(--card)] rounded-t-xl rounded-b-none [display:grid] [grid-template-rows:4px_31px_minmax(0,_1fr)] [min-height:0] [overflow:hidden] bottomPanel rounded-t-xl rounded-b-none`} ${collapsed ? `bottomCollapsed [border-top:0] [height:0] [grid-template-rows:0] [overflow:hidden] bottomCollapsed` : ""} ${active === "terminal" ? `bottomTerminalPanel [grid-template-rows:4px_minmax(0,_1fr)] bottomTerminalPanel` : ""}`}
            data-tool-window-position="bottom"
            ref={lifecycle.panelRef}
            style={collapsed ? undefined : { height }}
        >
            {!collapsed && (
                <div
                    aria-label="Resize bottom panel"
                    aria-orientation="horizontal"
                    aria-valuemax={MAX_BOTTOM_PANEL_HEIGHT}
                    aria-valuemin={MIN_BOTTOM_PANEL_HEIGHT}
                    aria-valuenow={height}
                    className={`bottomResizer [background:transparent] [cursor:ns-resize] [position:relative] [z-index:3] [&::after]:[background:var(--input)] [&::after]:[content:""] [&::after]:[height:1px] [&::after]:[left:0] [&::after]:[position:absolute] [&::after]:[right:0] [&::after]:[top:1px] [&:hover::after]:[background:var(--primary)] [&:hover::after]:[height:2px] [&:focus-visible::after]:[background:var(--primary)] [&:focus-visible::after]:[height:2px] bottomResizer`}
                    onDoubleClick={() =>
                        onHeightChange(DEFAULT_BOTTOM_PANEL_HEIGHT)
                    }
                    onKeyDown={resizePanelWithKeyboard}
                    onPointerDown={resizePanel}
                    role="separator"
                    tabIndex={0}
                />
            )}
            {!collapsed && active !== "terminal" && (
                <BottomPanelTabs
                    active={active}
                    onActiveChange={onActiveChange}
                    onExplicitOpen={() => {
                        lifecycle.explicitlyOpen();
                    }}
                    onHide={lifecycle.hidePanel}
                    stashCount={status.stashCount}
                />
            )}
            {!collapsed && (
                <div
                    aria-labelledby={`bottom-tool-tab-${active}`}
                    className={`toolContent [min-height:0] [overflow:hidden] toolContent`}
                    id="bottom-tool-panel"
                    role="tabpanel"
                >
                    {active === "shelf" && (
                        <ShelfSurface
                            dialog={dialog}
                            loadError={stash.loadError}
                            onApply={onApplyShelf}
                            onCreate={shelveChanges}
                            onDelete={onDeleteShelf}
                            shelves={shelves}
                        />
                    )}
                    {active === "stash" && (
                        <StashSurface
                            applyStash={stash.apply}
                            dialog={dialog}
                            dropStash={stash.drop}
                            mutation={stash.mutation}
                            onOpenDiff={onOpenStashDiff}
                            onOperation={onOperation}
                            runMutation={stash.runMutation}
                            stashChanges={stash.stashChanges}
                            stashFiles={stash.files}
                            stashes={stashes}
                            toggleFiles={stash.toggleFiles}
                        />
                    )}
                    {active === "recovery" && (
                        <RecoverySurface
                            dialog={dialog}
                            entries={recoveryEntries}
                            onRestore={onRestoreRecovery}
                        />
                    )}
                    {active === "find" && (
                        <FindResultsPanel
                            onOpenResult={onOpenFindResult}
                            onSearchAgain={onSearchAgain}
                            session={findResults}
                        />
                    )}
                    {active === "terminal" && (
                        <TerminalPanel
                            fixture={fixture}
                            onHide={lifecycle.hidePanel}
                            repositoryId={repositoryId}
                        />
                    )}
                    {active === "gitConsole" && (
                        <GitConsolePanel
                            entries={gitConsoleEntries}
                            onClear={onClearGitConsole}
                        />
                    )}
                    {active === "localHistory" && (
                        <LocalHistoryPanel
                            initialPath={lifecycle.localHistoryPath}
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
