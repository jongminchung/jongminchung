import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

export interface ProductNotification {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly kind: "info" | "success" | "error";
  readonly createdAt: number;
  readonly actions?: readonly ("modifyShortcuts" | "dismiss" | "more" | "openUrl")[];
  readonly url?: string;
}

export function NotificationBalloon({
  notification,
  onAction,
  onDismiss,
}: {
  readonly notification: ProductNotification;
  readonly onAction: (action: "modifyShortcuts" | "dismiss" | "more" | "openUrl") => void;
  readonly onDismiss: () => void;
}) {
  const actionLabel = {
    modifyShortcuts: "Modify Shortcuts",
    dismiss: "Don't Show Again",
    more: "More",
    openUrl: "Open Repository",
  } as const;
  return (
    <aside aria-label={notification.title} className={tw.notificationBalloon} role="status">
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
            {notification.actions.map((action) => (
              <button key={action} onClick={() => onAction(action)}>
                {actionLabel[action]}
              </button>
            ))}
          </footer>
        )}
      </div>
      <button aria-label={`Hide ${notification.title}`} onClick={onDismiss}>
        <Icon name="chevron" size={11} />
      </button>
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
    <aside className={tw.notificationToolWindow} aria-label="Notifications">
      <header>
        <strong>Notifications</strong>
        <span>{notifications.length || ""}</span>
        <button
          aria-label="Clear Notifications"
          disabled={notifications.length === 0}
          onClick={onClear}
          title="Clear All"
        >
          <Icon name="trash" size={13} />
        </button>
        <button aria-label="Close Notifications" onClick={onClose} title="Close">
          <Icon name="close" size={13} />
        </button>
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
              <time>{new Date(notification.createdAt).toLocaleTimeString()}</time>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
