import { Button } from "@jongminchung/ui/components/button";
import { Spinner as SpinnerIcon } from "@jongminchung/ui/components/spinner";
import { Toggle } from "@jongminchung/ui/components/toggle";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { useAppDialog } from "../components/AppDialog";
import { Icon } from "../components/Icon";
import { StatePill } from "../components/ProductCollections";
import type { ActivityStatus } from "../domain/gitActivity";
import type { ProductSettings } from "../domain/productSettings";
import { toVoidHandler } from "../domain/toVoidHandler";
import type { GitSessionController } from "../git-session/useGitSessionController";
import { useRepositoryWorkspaceStore } from "./state/RepositoryWorkspaceStoreProvider";

type GitSession = GitSessionController;

const ACTIVITY_STATUS_TONE = {
    running: "neutral",
    succeeded: "success",
    failed: "destructive",
    cancelled: "disabled",
} as const satisfies Readonly<Record<ActivityStatus, string>>;

export function RepositoryStatusBar({
    navigationStatus,
    productSettings,
    session,
    terminalFocused,
}: {
    readonly navigationStatus: string;
    readonly productSettings: ProductSettings;
    readonly session: GitSession;
    readonly terminalFocused: boolean;
}) {
    const {
        current: activity,
        cancel: cancelActivity,
        retry: retryActivity,
    } = session.activity;
    const { reload } = session.queries;
    const { editorStatus, notifications, setNotificationOpen, setToast } =
        useRepositoryWorkspaceStore(
            useShallow((state) => ({
                editorStatus: state.editorStatus,
                notifications: state.notifications,
                setNotificationOpen: state.setNotificationOpen,
                setToast: state.setToast,
            })),
        );
    const dialog = useAppDialog();
    if (!productSettings.statusBarVisible || productSettings.presentationMode)
        return null;
    return (
        <footer
            aria-label="Status Bar"
            className={`statusbar [align-items:center] [background:var(--card)] [border-top:1px_solid_var(--border)] [color:var(--muted-foreground)] [display:flex] [font-size:9px] [gap:5px] [padding:0_5px_0_8px] [&>_nav]:[flex:1] [&>_nav]:[min-width:0] [&>_span]:[align-items:center] [&>_span]:[display:flex] [&>_span]:[gap:4px] bg-background! border-transparent! statusbar`}
        >
            {productSettings.navigationBar === "status" && (
                <nav aria-label="Navigation Bar">
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label={navigationStatus}
                                    className={cn(
                                        "min-w-0 gap-1 p-0 text-[9px] text-muted-foreground",
                                    )}
                                    variant="ghost"
                                    size="xs"
                                >
                                    <Icon name="folder" size={12} />
                                    <span className="min-w-0 truncate">
                                        {navigationStatus}
                                    </span>
                                </Button>
                            }
                        />
                        <TooltipContent>{navigationStatus}</TooltipContent>
                    </Tooltip>
                </nav>
            )}
            {productSettings.navigationBar !== "status" && (
                <span
                    className={`statusbarSpacer [flex:1] [min-width:0] statusbarSpacer`}
                />
            )}
            <span className={`activitySlot [min-width:0] activitySlot`}>
                {activity &&
                    (productSettings.statusBarWidgets.statusText ||
                        productSettings.statusBarWidgets.fileSystemSync) && (
                        <StatePill
                            className="min-h-[18px] max-w-[420px] gap-1.5 rounded-lg px-1.5 py-px"
                            role="status"
                            tone={ACTIVITY_STATUS_TONE[activity.status]}
                            title={activity.error ?? undefined}
                        >
                            {activity.status === "running" ? (
                                <SpinnerIcon aria-hidden className="size-3" />
                            ) : activity.status === "succeeded" ? (
                                <Icon name="check" size={11} />
                            ) : (
                                <Icon name="warning" size={11} />
                            )}
                            {productSettings.statusBarWidgets.statusText && (
                                <span>{activity.label}</span>
                            )}
                            {activity.status === "running" &&
                                activity.requestIds.length > 0 && (
                                    <Button
                                        className="h-auto rounded-none p-0 text-[9px] text-inherit"
                                        onClick={() => void cancelActivity()}
                                        variant="link"
                                        size="xs"
                                    >
                                        Cancel
                                    </Button>
                                )}
                            {activity.status === "failed" &&
                                activity.canRetry && (
                                    <Button
                                        className="h-auto rounded-none p-0 text-[9px] text-inherit"
                                        onClick={() => void retryActivity()}
                                        variant="link"
                                        size="xs"
                                    >
                                        Retry
                                    </Button>
                                )}
                        </StatePill>
                    )}
            </span>
            <span
                className={`statusbarWidgets [align-self:stretch] [display:flex] [gap:0]! statusbarWidgets`}
            >
                {productSettings.statusBarWidgets.fileSystemSync && (
                    <Button
                        aria-label="Refresh repository"
                        className={cn(
                            "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                        )}
                        onClick={() => void reload()}
                        variant="ghost"
                        size="icon"
                    >
                        <Icon name="refresh" size={11} />
                    </Button>
                )}
                {productSettings.statusBarWidgets.aggregator && (
                    <Button
                        aria-label="Open notifications"
                        className={cn(
                            "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                        )}
                        onClick={() => setNotificationOpen(true)}
                        variant="ghost"
                        size="icon"
                    >
                        <Icon name="warning" size={11} />
                    </Button>
                )}
                {productSettings.statusBarWidgets.lineColumn && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Go to Line"
                                    className={cn(
                                        "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                                    )}
                                    onClick={toVoidHandler(async () => {
                                        const value = await dialog.input({
                                            title: "Go to Line",
                                            label: "Line and column",
                                            initialValue: editorStatus
                                                ? `${editorStatus.line}:${editorStatus.column}`
                                                : "1:1",
                                            placeholder: "42:1",
                                            confirmLabel: "Go",
                                            validate: (candidate) =>
                                                /^[1-9]\d*(?::[1-9]\d*)?$/u.test(
                                                    candidate,
                                                )
                                                    ? null
                                                    : "Enter a line or line:column value.",
                                        });
                                        if (value === null) return;
                                        const [line, column = "1"] =
                                            value.split(":");
                                        window.dispatchEvent(
                                            new CustomEvent(
                                                "git-client:go-to-line",
                                                {
                                                    detail: {
                                                        line: Number(line),
                                                        column: Number(column),
                                                    },
                                                },
                                            ),
                                        );
                                    })}
                                    variant="ghost"
                                    size="xs"
                                >
                                    {editorStatus
                                        ? `${editorStatus.line}:${editorStatus.column}`
                                        : ""}
                                </Button>
                            }
                        />
                        <TooltipContent>Go to Line</TooltipContent>
                    </Tooltip>
                )}
                {productSettings.statusBarWidgets.languageServices && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Language Services Button"
                                    className={cn(
                                        "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                                    )}
                                    onClick={() =>
                                        setToast(
                                            editorStatus
                                                ? `${editorStatus.language} language services are active.`
                                                : "No language service is active for the Git Log.",
                                        )
                                    }
                                    variant="ghost"
                                    size="xs"
                                >
                                    {editorStatus?.language ?? ""}
                                </Button>
                            }
                        />
                        <TooltipContent>Language Services</TooltipContent>
                    </Tooltip>
                )}
                {productSettings.statusBarWidgets.gridPosition && (
                    <Button
                        aria-label="Grid position"
                        className={cn(
                            "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                        )}
                        variant="ghost"
                        size="xs"
                    >
                        {editorStatus ? "1 × 1" : ""}
                    </Button>
                )}
                {productSettings.statusBarWidgets.lineSeparator && (
                    <Button
                        aria-label="Line separator"
                        className={cn(
                            "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                        )}
                        variant="ghost"
                        size="xs"
                    >
                        {editorStatus?.lineSeparator ?? ""}
                    </Button>
                )}
                {productSettings.statusBarWidgets.fileEncoding && (
                    <Button
                        aria-label="File encoding"
                        className={cn(
                            "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                        )}
                        variant="ghost"
                        size="xs"
                    >
                        {editorStatus ? "UTF-8" : ""}
                    </Button>
                )}
                {productSettings.statusBarWidgets.editorSelectionMode && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Toggle
                                    aria-label="Column selection mode"
                                    className="group/toggle inline-flex h-full min-w-5 shrink-0 items-center justify-center rounded-none bg-transparent px-1 text-[9px] font-medium text-muted-foreground outline-none transition-all hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:text-disabled-foreground disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-pressed:bg-accent data-pressed:text-foreground"
                                    data-slot="toggle"
                                    onPressedChange={() =>
                                        window.dispatchEvent(
                                            new CustomEvent(
                                                "git-client:toggle-column-selection",
                                            ),
                                        )
                                    }
                                    pressed={
                                        editorStatus?.columnSelection ?? false
                                    }
                                >
                                    {editorStatus?.columnSelection
                                        ? "Column"
                                        : ""}
                                </Toggle>
                            }
                        />
                        <TooltipContent>Column selection mode</TooltipContent>
                    </Tooltip>
                )}
                {productSettings.statusBarWidgets.powerSaveMode && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Power Save Mode"
                                    className={cn(
                                        "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                                    )}
                                    variant="ghost"
                                    size="xs"
                                >
                                    {productSettings.powerSaveMode
                                        ? "Power Save Mode"
                                        : ""}
                                </Button>
                            }
                        />
                        <TooltipContent>
                            {productSettings.powerSaveMode
                                ? "Power Save Mode is enabled"
                                : "Power Save Mode"}
                        </TooltipContent>
                    </Tooltip>
                )}
                {productSettings.statusBarWidgets.indentation && (
                    <Button
                        aria-label="Indentation"
                        className={cn(
                            "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                        )}
                        variant="ghost"
                        size="xs"
                    >
                        {editorStatus?.indentation ?? ""}
                    </Button>
                )}
                {productSettings.statusBarWidgets.readOnlyAttribute && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label={
                                        terminalFocused ||
                                        editorStatus?.readOnly === false
                                            ? "Make file read-only"
                                            : "Make file writable"
                                    }
                                    className={cn(
                                        "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                                    )}
                                    onClick={() =>
                                        setToast(
                                            editorStatus?.readOnly
                                                ? "Revision content is read-only. Open its working-tree file to edit it."
                                                : "The current surface is already writable.",
                                        )
                                    }
                                    variant="ghost"
                                    size="xs"
                                >
                                    {editorStatus?.readOnly ? "RO" : ""}
                                </Button>
                            }
                        />
                        <TooltipContent>
                            {terminalFocused || editorStatus?.readOnly === false
                                ? "Make file read-only"
                                : "Make file writable"}
                        </TooltipContent>
                    </Tooltip>
                )}
                {productSettings.statusBarWidgets.memoryIndicator && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="Memory Indicator"
                                    className={cn(
                                        "h-full min-w-5 rounded-none px-1 text-[9px] text-muted-foreground disabled:text-disabled-foreground disabled:opacity-100",
                                    )}
                                    variant="ghost"
                                    size="xs"
                                >
                                    Memory
                                </Button>
                            }
                        />
                        <TooltipContent>Memory Indicator</TooltipContent>
                    </Tooltip>
                )}
                {notifications.some(
                    (notification) => notification.kind === "error",
                ) && (
                    <Tooltip>
                        <TooltipTrigger
                            render={
                                <Button
                                    aria-label="IDE error occurred"
                                    className={cn(
                                        "h-full min-w-5 rounded-none bg-transparent px-1 text-[9px] hover:bg-destructive-muted",
                                    )}
                                    onClick={() => setNotificationOpen(true)}
                                    variant="destructive"
                                    size="icon"
                                >
                                    <Icon name="warning" size={11} />
                                </Button>
                            }
                        />
                        <TooltipContent>See details</TooltipContent>
                    </Tooltip>
                )}
            </span>
        </footer>
    );
}
