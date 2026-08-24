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
      className="notificationBalloon"
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
    <aside className="notificationToolWindow" aria-label="Notifications">
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
                {new Date(notification.createdAt).toLocaleTimeString()}
              </time>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
