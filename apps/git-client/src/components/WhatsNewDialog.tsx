import { Button } from "@base-ui/react/button";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";

const UPDATES = [
  {
    title: "Electron workspace",
    description:
      "Native macOS menus, isolated profiles, secure preload APIs, and restored window state.",
    icon: "settings" as const,
  },
  {
    title: "Project, Log, Commit, and editor",
    description:
      "Browse files and history, review diffs, stage partial work, and commit from one workbench.",
    icon: "file" as const,
  },
  {
    title: "Git operations and recovery",
    description:
      "Branch, merge, rebase, worktree, stash, shelf, conflict, patch, and recovery workflows.",
    icon: "branch" as const,
  },
  {
    title: "GitHub and GitLab",
    description: "Accounts, pull or merge requests, reviews, discussions, and project sharing.",
    icon: "external" as const,
  },
  {
    title: "Terminal and diagnostics",
    description:
      "PTY terminal tabs, Git Console, Local History, Activity Monitor, and local support bundles.",
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
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
