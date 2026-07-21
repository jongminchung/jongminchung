import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ActionAvailability } from "../domain/types";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { DropdownMenuItem } from "./ui";
import { useLayer } from "./ui";

interface MenuItem {
  readonly id: keyof ActionAvailability | "separator";
  readonly label?: string;
  readonly icon?: Parameters<typeof Icon>[0]["name"];
  readonly shortcut?: string;
  readonly danger?: boolean;
}
const menu: readonly MenuItem[] = [
  { id: "copyRevision", label: "Copy Revision Number", icon: "copy", shortcut: "⌥⇧⌘C" },
  { id: "createPatch", label: "Create Patch…", icon: "patch" },
  { id: "copyPatch", label: "Copy Patch to Clipboard", icon: "copy" },
  { id: "cherryPick", label: "Cherry-Pick", icon: "cherry" },
  { id: "separator" },
  { id: "showRepositoryAtRevision", label: "Show Repository at Revision", icon: "folder" },
  { id: "compareVersions", label: "Compare Versions", icon: "compare" },
  { id: "separator" },
  { id: "reset", label: "Reset Current Branch to Here…", icon: "undo", danger: true },
  { id: "revert", label: "Revert Commits", icon: "undo" },
  { id: "undoCommit", label: "Undo Last Commit", icon: "undo" },
  { id: "reword", label: "Reword Commit…", icon: "commit" },
  { id: "fixup", label: "Create Fixup Commit", icon: "commit" },
  { id: "squashInto", label: "Create Squash Commit", icon: "commit" },
  { id: "separator" },
  {
    id: "interactiveRebase",
    label: "Interactive Rebase from Here…",
    icon: "compare",
    danger: true,
  },
  { id: "drop", label: "Drop Commits", icon: "trash", danger: true },
  { id: "squash", label: "Squash Commits…", icon: "commit", danger: true },
  { id: "pushUpTo", label: "Push All up to Here…", icon: "push" },
  { id: "separator" },
  { id: "newBranch", label: "New Branch…", icon: "branch", shortcut: "⌥⌘N" },
  { id: "newTag", label: "New Tag…", icon: "tag" },
  { id: "separator" },
  { id: "goToChild", label: "Go to Child Commit", icon: "commit", shortcut: "←" },
  { id: "goToParent", label: "Go to Parent Commit", icon: "commit", shortcut: "→" },
  { id: "separator" },
  { id: "viewInBrowser", label: "View in browser", icon: "globe" },
];

export function CommitContextMenu({
  x,
  y,
  availability,
  onAction,
  onClose,
}: {
  readonly x: number;
  readonly y: number;
  readonly availability: ActionAvailability;
  readonly onAction: (action: keyof ActionAvailability) => void;
  readonly onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const handleHide = useCallback(() => {
    previousFocus.current?.focus();
    onClose();
  }, [onClose]);
  const layer = useLayer({
    mode: "fixed",
    lightDismiss: true,
    onHide: handleHide,
  });
  useDismissLayer(
    useMemo(
      () => ({
        id: "commit-context-menu",
        priority: 115,
        active: true,
        dismiss: () => {
          layer.hide();
        },
      }),
      [layer.hide],
    ),
  );
  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layer.show();
    return () => previousFocus.current?.focus();
  }, [layer.show]);
  useEffect(() => {
    if (!layer.isOpen) return;
    const frame = requestAnimationFrame(() => {
      root.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [layer.isOpen]);

  return layer.render(
    <div
      className="grid max-h-[min(520px,calc(100vh-24px))] min-w-[290px] gap-0.5 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-med"
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const items = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([aria-disabled="true"])',
          ),
        ];
        const current = items.findIndex((item) => item === document.activeElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : event.key === "ArrowDown"
                ? (current + 1) % items.length
                : (current - 1 + items.length) % items.length;
        items[next]?.focus();
        event.preventDefault();
      }}
      ref={root}
      role="menu"
    >
      {menu.map((item, index) => {
        if (item.id === "separator")
          return <hr className="my-1 border-0 border-t border-border" key={index} />;
        const action = item.id;
        return (
          <DropdownMenuItem
            className={item.danger ? "text-destructive" : undefined}
            endContent={item.shortcut ? <kbd>{item.shortcut}</kbd> : undefined}
            icon={item.icon ? <Icon name={item.icon} size={16} /> : undefined}
            isDisabled={!availability[action]}
            key={action}
            label={item.label}
            onClick={() => onAction(action)}
          />
        );
      })}
    </div>,
    {
      x: Math.min(x, window.innerWidth - 310),
      y: Math.min(y, window.innerHeight - 520),
    },
  );
}
