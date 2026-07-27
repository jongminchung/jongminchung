import { Menu } from "@base-ui/react/menu";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ActionAvailability } from "../domain/types";
import { useDismissLayer } from "./CommandProvider";
import { Icon } from "./Icon";
import { DropdownMenuItem } from "./ui";

interface MenuItem {
  readonly id: keyof ActionAvailability | "separator";
  readonly label?: string;
  readonly icon?: Parameters<typeof Icon>[0]["name"];
  readonly shortcut?: string;
  readonly danger?: boolean;
}
const menu: readonly MenuItem[] = [
  {
    id: "copyRevision",
    label: "Copy Revision Number",
    icon: "copy",
    shortcut: "⌥⇧⌘C",
  },
  { id: "createPatch", label: "Create Patch…", icon: "patch" },
  { id: "copyPatch", label: "Copy Patch to Clipboard", icon: "copy" },
  { id: "cherryPick", label: "Cherry-Pick", icon: "cherry" },
  { id: "separator" },
  {
    id: "showRepositoryAtRevision",
    label: "Show Repository at Revision",
    icon: "folder",
  },
  { id: "compareVersions", label: "Compare Versions", icon: "compare" },
  { id: "separator" },
  {
    id: "reset",
    label: "Reset Current Branch to Here…",
    icon: "undo",
    danger: true,
  },
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
  {
    id: "goToChild",
    label: "Go to Child Commit",
    icon: "commit",
    shortcut: "←",
  },
  {
    id: "goToParent",
    label: "Go to Parent Commit",
    icon: "commit",
    shortcut: "→",
  },
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
  const previousFocus = useRef<HTMLElement | null>(null);
  const close = useCallback(() => {
    previousFocus.current?.focus();
    onClose();
  }, [onClose]);
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () => new DOMRect(x, y),
    }),
    [x, y],
  );
  useDismissLayer(
    useMemo(
      () => ({
        id: "commit-context-menu",
        priority: 115,
        active: true,
        dismiss: close,
      }),
      [close],
    ),
  );
  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => previousFocus.current?.focus();
  }, []);

  return (
    <Menu.Root
      onOpenChange={(open) => {
        if (!open) close();
      }}
      open
    >
      <Menu.Portal>
        <Menu.Positioner
          align="start"
          anchor={anchor}
          className="z-[130]"
          collisionPadding={8}
          positionMethod="fixed"
          side="bottom"
        >
          <Menu.Popup
            aria-label="Commit actions"
            className="grid max-h-[min(520px,calc(100vh-24px))] min-w-[290px] gap-0.5 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none"
            finalFocus={false}
          >
            {menu.map((item, index) => {
              if (item.id === "separator") {
                return (
                  <Menu.Separator className="my-1 h-px bg-border" key={`separator-${index}`} />
                );
              }
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
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
