import { openExternalUrl } from "../../../application/desktop/DesktopPort";
import {
  NotificationBalloon,
  NotificationToolWindow,
} from "../../../components/NotificationToolWindow";
import { useRepositoryToolWindowCapability } from "../RepositoryWorkspaceFeatureContext";
import { RepositoryRightToolStripe } from "./RepositoryChrome";

export function RepositoryNotificationFeature() {
  const {
    balloonId,
    notificationOpen,
    notifications,
    onDismissShortcutConflictWarning,
    onOpenSettings,
    setBalloonId,
    setNotificationOpen,
    setNotifications,
  } = useRepositoryToolWindowCapability();

  return (
    <>
      {notificationOpen && (
        <NotificationToolWindow
          notifications={notifications}
          onClear={() => setNotifications([])}
          onClose={() => setNotificationOpen(false)}
        />
      )}
      {balloonId &&
        (() => {
          const notification = notifications.find(
            (item) => item.id === balloonId,
          );
          return notification ? (
            <NotificationBalloon
              notification={notification}
              onAction={(action) => {
                if (action === "modifyShortcuts") {
                  onOpenSettings();
                } else if (action === "openUrl" && notification.url) {
                  void openExternalUrl(notification.url);
                } else if (action === "dismiss") {
                  onDismissShortcutConflictWarning();
                  setNotifications((current) =>
                    current.filter((item) => item.id !== notification.id),
                  );
                } else {
                  setNotificationOpen(true);
                }
                setBalloonId(undefined);
              }}
              onDismiss={() => setBalloonId(undefined)}
            />
          ) : null;
        })()}
      <RepositoryRightToolStripe
        notificationCount={notifications.length}
        notificationsOpen={notificationOpen}
        onToggleNotifications={() => setNotificationOpen((current) => !current)}
      />
    </>
  );
}
