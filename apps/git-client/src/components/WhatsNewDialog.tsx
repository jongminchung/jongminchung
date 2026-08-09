import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
      <section
        className={`whatsNewDialog [display:grid] [grid-template-rows:auto_minmax(300px,_1fr)_auto] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main>_p]:[color:var(--muted-foreground)] [&>_main>_p]:[margin:14px_16px_8px] [&>_main>_div[role=list]]:[padding:5px_9px_12px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_10px] whatsNewDialog`}
      >
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
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
