import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

const HELP_TOPICS: readonly Readonly<{
  label: string;
  description: string;
}>[] = [
  {
    label: "Open or clone a repository",
    description: "File › Open… or File › New › Project from Version Control…",
  },
  {
    label: "Inspect history",
    description: "Open Log, then filter by branch, user, date, or path.",
  },
  {
    label: "Commit changes",
    description:
      "Open Commit, select files, review the diff, and enter a message.",
  },
  {
    label: "Run Git operations",
    description: "Use Git › VCS Operations Popup… or press Control-V.",
  },
  {
    label: "Open the terminal",
    description: "View › Tool Windows › Terminal or press Option-F12.",
  },
];

export function ProductHelpDialog({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      aria-label="Help"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={620}
    >
      <section
        className={`productHelpDialog productHelpDialog [display:grid] [grid-template-rows:auto_minmax(300px,_1fr)_auto] [&>_footer]:[display:flex] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_10px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main>_div[role=list]]:[padding:5px_9px_12px] [&>_main>_p]:[margin:14px_16px_8px] [&>_main>_p]:[color:var(--muted-foreground)]`}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Git Client Help"
        />
        <main>
          <p>
            Use the same project, editor, Log, Commit, Git, and Terminal
            workflow from one window.
          </p>
          <List aria-label="Help topics" density="compact" role="list">
            {HELP_TOPICS.map((topic) => (
              <ListItem
                description={topic.description}
                key={topic.label}
                label={topic.label}
                role="listitem"
                startContent={<Icon name="file" size={14} />}
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
