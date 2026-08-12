import { Button } from "@jongminchung/ui/components/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { Icon } from "./Icon";

export interface ProductNotification {
    readonly id: string;
    readonly title: string;
    readonly message: string;
    readonly kind: "info" | "success" | "error";
    readonly createdAt: number;
    readonly actions?: readonly (
        | "modifyShortcuts"
        | "dismiss"
        | "more"
        | "openUrl"
    )[];
    readonly url?: string;
}

export function NotificationBalloon({
    notification,
    onAction,
    onDismiss,
}: {
    readonly notification: ProductNotification;
    readonly onAction: (
        action: "modifyShortcuts" | "dismiss" | "more" | "openUrl",
    ) => void;
    readonly onDismiss: () => void;
}) {
    const actionLabel = {
        modifyShortcuts: "Modify Shortcuts",
        dismiss: "Don't Show Again",
        more: "More",
        openUrl: "Open Repository",
    } as const;
    return (
        <aside
            aria-label={notification.title}
            className={`notificationBalloon bg-feedback! [align-items:start] [background:var(--popover)] [border:1px_solid_var(--input)] rounded-lg [bottom:32px] [box-shadow:var(--shadow-lg)] [display:grid] [gap:8px] [grid-template-columns:17px_minmax(0,_1fr)_18px] [padding:10px_10px_9px] [position:fixed] [right:31px] [width:320px] [z-index:75] [&>_svg]:[color:var(--warning)] [&>_div]:[min-width:0] [&_strong]:[display:block] [&_p]:[color:var(--muted-foreground)] [&_p]:[line-height:1.35] [&_p]:[margin:3px_0_0] [&_p]:[max-height:34px] [&_p]:[overflow:hidden] [&_footer]:[display:flex] [&_footer]:[gap:12px] [&_footer]:[margin-top:7px] [&_footer_button]:[background:transparent] [&_footer_button]:[color:var(--primary)] [&_footer_button]:[font-size:11px] [&_footer_button]:[padding:0] [&>_button]:[align-items:center] [&>_button]:[background:transparent] [&>_button]:[color:var(--disabled-foreground)] [&>_button]:[display:flex] [&>_button]:[height:18px] [&>_button]:[justify-content:center] [&>_button]:[padding:0] [&>_button]:[width:18px] notificationBalloon rounded-lg`}
            role="status"
        >
            <Icon
                name={
                    notification.kind === "error"
                        ? "warning"
                        : notification.kind === "success"
                          ? "check"
                          : "warning"
                }
                size={15}
            />
            <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
                {notification.actions && (
                    <footer>
                        {notification.actions.map((action) =>
                            action === "openUrl" && notification.url ? (
                                <a
                                    className={cn(
                                        "inline-flex min-h-[26px] min-w-[26px] items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent p-1 text-xs text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/55",
                                    )}
                                    href={notification.url}
                                    key={action}
                                    onClick={(event) => {
                                        event.preventDefault();
                                        onAction(action);
                                    }}
                                >
                                    {actionLabel[action]}
                                </a>
                            ) : (
                                <Button
                                    key={action}
                                    onClick={() => onAction(action)}
                                    type="button"
                                    className={cn(
                                        "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                                    )}
                                    variant="ghost"
                                    size="xs"
                                >
                                    {actionLabel[action]}
                                </Button>
                            ),
                        )}
                    </footer>
                )}
            </div>
            <Button
                aria-label={`Hide ${notification.title}`}
                onClick={onDismiss}
                type="button"
                className={cn(
                    "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                )}
                variant="ghost"
                size="icon-sm"
            >
                <Icon name="chevron" size={11} />
            </Button>
        </aside>
    );
}

export function NotificationToolWindow({
    notifications,
    onClear,
    onClose,
}: {
    readonly notifications: readonly ProductNotification[];
    readonly onClear: () => void;
    readonly onClose: () => void;
}) {
    return (
        <aside
            className={`notificationToolWindow [background:var(--card)] [border:1px_solid_var(--border)] rounded-lg [bottom:18px] [box-shadow:var(--shadow-lg)] [display:grid] [grid-template-rows:30px_minmax(0,_1fr)] [position:fixed] [right:30px] [top:56px] [width:340px] [z-index:35] [&>_header]:[align-items:center] [&>_header]:[background:var(--secondary)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:5px] [&>_header]:[padding:0_5px_0_8px] [&>_header>_strong]:[flex:1] [&>_header>_span]:[color:var(--disabled-foreground)] [&>_header>_button]:[align-items:center] [&>_header>_button]:[background:transparent] [&>_header>_button]:[display:flex] [&>_header>_button]:[height:24px] [&>_header>_button]:[justify-content:center] [&>_header>_button]:[width:24px] [&>_div]:[min-height:0] [&>_div]:[overflow:auto] [&>_div>_p]:[color:var(--muted-foreground)] [&>_div>_p]:[padding:24px] [&>_div>_p]:[text-align:center] [&_article]:[align-items:start] [&_article]:[border-bottom:1px_solid_var(--border)] [&_article]:[display:grid] [&_article]:[gap:7px] [&_article]:[grid-template-columns:18px_minmax(0,_1fr)_auto] [&_article]:[padding:8px] [&_article>_span]:[display:grid] [&_article_strong]:[font-size:11px] [&_article_small]:[color:var(--muted-foreground)] [&_article_small]:[line-height:1.35] [&_article_time]:[color:var(--disabled-foreground)] [&_article_time]:[font-size:9px] notificationToolWindow rounded-lg`}
            aria-label="Notifications"
        >
            <header>
                <strong>Notifications</strong>
                <span>{notifications.length || ""}</span>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="Clear Notifications"
                                disabled={notifications.length === 0}
                                onClick={onClear}
                                type="button"
                                className={cn(
                                    "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                                )}
                                variant="ghost"
                                size="icon-sm"
                            >
                                <Icon name="trash" size={13} />
                            </Button>
                        }
                    />
                    <TooltipContent>Clear All</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                aria-label="Close Notifications"
                                onClick={onClose}
                                type="button"
                                className={cn(
                                    "gap-1.5 text-xs min-h-[26px] min-w-[26px] p-1 text-muted-foreground",
                                )}
                                variant="ghost"
                                size="icon-sm"
                            >
                                <Icon name="close" size={13} />
                            </Button>
                        }
                    />
                    <TooltipContent>Close</TooltipContent>
                </Tooltip>
            </header>
            <div role="feed" aria-label="Notification history">
                {notifications.length === 0 ? (
                    <p>No new notifications.</p>
                ) : (
                    notifications.map((notification) => (
                        <article key={notification.id}>
                            <Icon
                                name={
                                    notification.kind === "error"
                                        ? "warning"
                                        : notification.kind === "success"
                                          ? "check"
                                          : "branch"
                                }
                                size={15}
                            />
                            <span>
                                <strong>{notification.title}</strong>
                                <small>{notification.message}</small>
                            </span>
                            <time>
                                {new Date(
                                    notification.createdAt,
                                ).toLocaleTimeString()}
                            </time>
                        </article>
                    ))
                )}
            </div>
        </aside>
    );
}
