import type { ActionAvailability } from "../domain/types";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

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
  { id: "cherryPick", label: "Cherry-Pick", icon: "cherry" },
  { id: "separator" },
  { id: "showRepositoryAtRevision", label: "Show Repository at Revision", icon: "folder" },
  { id: "compareVersions", label: "Compare Versions", icon: "compare" },
  { id: "separator" },
  { id: "reset", label: "Reset Current Branch to Here…", icon: "undo", danger: true },
  { id: "revert", label: "Revert Commits", icon: "undo" },
  { id: "separator" },
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
}: {
  readonly x: number;
  readonly y: number;
  readonly availability: ActionAvailability;
  readonly onAction: (action: keyof ActionAvailability) => void;
}) {
  return (
    <div
      className={styles.contextMenu}
      role="menu"
      style={{
        left: Math.min(x, window.innerWidth - 310),
        top: Math.min(y, window.innerHeight - 520),
      }}
    >
      {menu.map((item, index) => {
        if (item.id === "separator") return <hr key={index} />;
        const action = item.id;
        return (
          <button
            className={item.danger ? styles.dangerMenuItem : undefined}
            disabled={!availability[action]}
            key={action}
            onClick={() => onAction(action)}
            role="menuitem"
          >
            {item.icon && <Icon name={item.icon} size={16} />}
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        );
      })}
    </div>
  );
}
