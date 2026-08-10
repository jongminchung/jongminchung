import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ProductNotification } from "../../components/NotificationToolWindow";
import type { GitActivity } from "../../domain/gitActivity";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";

export function useRepositoryNotifications({
  sessionActivity,
  sessionError,
  showNotifications,
  showShortcutConflictWarning,
}: {
  readonly sessionActivity: GitActivity | null;
  readonly sessionError: string | null;
  readonly showNotifications: boolean;
  readonly showShortcutConflictWarning: boolean;
}): void {
  const { balloonId, setBalloonId, setNotificationOpen, setNotifications, setToast, toast } =
    useRepositoryWorkspaceStore(
      useShallow((state) => ({
        balloonId: state.balloonId,
        setBalloonId: state.setBalloonId,
        setNotificationOpen: state.setNotificationOpen,
        setNotifications: state.setNotifications,
        setToast: state.setToast,
        toast: state.toast,
      })),
    );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 2_800);
    return () => window.clearTimeout(timeout);
  }, [setToast, toast]);

  useEffect(() => {
    if (!showNotifications || !showShortcutConflictWarning) return;
    const notification: ProductNotification = {
      id: "macos-shortcut-conflicts",
      title: "Shortcuts conflicts",
      message:
        "Find Action… and 16 more shortcut conflict with macOS shortcuts. Modify these shortcuts or change macOS system settings.",
      kind: "info",
      createdAt: Date.now(),
      actions: ["modifyShortcuts", "dismiss", "more"],
    };
    setNotifications((current) =>
      current.some((item) => item.id === notification.id) ? current : [...current, notification],
    );
    setBalloonId(notification.id);
  }, [showNotifications, showShortcutConflictWarning, setNotifications, setBalloonId]);

  useEffect(() => {
    if (!balloonId) return;
    const timeout = window.setTimeout(() => {
      setBalloonId(undefined);
      if (balloonId === "macos-shortcut-conflicts") {
        setNotifications((current) => current.filter((item) => item.id !== balloonId));
      }
    }, 10_000);
    return () => window.clearTimeout(timeout);
  }, [balloonId, setNotifications, setBalloonId]);

  useEffect(() => {
    const activity = sessionActivity;
    if (!showNotifications || !activity || activity.status === "running") return;
    const notification: ProductNotification = {
      id: `activity:${activity.id}:${activity.status}`,
      title: activity.label,
      message:
        activity.status === "failed"
          ? (activity.error ?? "Git operation failed.")
          : activity.status === "cancelled"
            ? "Cancelled"
            : "Completed",
      kind:
        activity.status === "failed"
          ? "error"
          : activity.status === "succeeded"
            ? "success"
            : "info",
      createdAt: Date.now(),
    };
    setNotifications((current) =>
      current.some((item) => item.id === notification.id)
        ? current
        : [...current, notification].slice(-100),
    );
    setBalloonId(notification.id);
  }, [sessionActivity, showNotifications, setNotifications, setBalloonId]);

  useEffect(() => {
    if (!showNotifications || !sessionError) return;
    const notification: ProductNotification = {
      id: `error:${sessionError}`,
      title: "Git Error",
      message: sessionError,
      kind: "error",
      createdAt: Date.now(),
    };
    setNotifications((current) =>
      current.some((item) => item.id === notification.id)
        ? current
        : [...current, notification].slice(-100),
    );
    setBalloonId(notification.id);
  }, [sessionError, showNotifications, setNotifications, setBalloonId]);

  useEffect(() => {
    if (showNotifications) return;
    setNotifications([]);
    setNotificationOpen(false);
    setBalloonId(undefined);
  }, [showNotifications, setNotificationOpen, setBalloonId, setNotifications]);
}
