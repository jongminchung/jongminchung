import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

const UPDATES = [
  {
    title: "Electron workspace",
    description: "Native macOS menus, isolated profiles, secure preload APIs, and restored window state.",
    icon: "settings" as const,
  },
  {
    title: "Project, Log, Commit, and editor",
    description: "Browse files and history, review diffs, stage partial work, and commit from one workbench.",
    icon: "file" as const,
  },
  {
    title: "Git operations and recovery",
    description: "Branch, merge, rebase, worktree, stash, shelf, conflict, patch, and recovery workflows.",
    icon: "branch" as const,
  },
  {
    title: "GitHub and GitLab",
    description: "Accounts, pull or merge requests, reviews, discussions, and project sharing.",
    icon: "external" as const,
  },
  {
    title: "Terminal and diagnostics",
    description: "PTY terminal tabs, Git Console, Local History, Activity Monitor, and local support bundles.",
    icon: "console" as const,
  },
] as const;

export function WhatsNewDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <Dialog
      aria-label="What's New in Git Client"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={620}
    >
      <section className={tw.whatsNewDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="What's New in Git Client"
        />
        <main>
          <p>Highlights available in this Git Client build.</p>
          <List aria-label="Git Client updates" density="compact" role="list">
            {UPDATES.map((update) => (
              <ListItem
                description={update.description}
                key={update.title}
                label={update.title}
                role="listitem"
                startContent={<Icon name={update.icon} size={14} />}
              />
            ))}
          </List>
        </main>
        <footer>
          <Button label="Close" onClick={onClose} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
