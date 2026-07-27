import { Button } from "@base-ui/react/button";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";

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
    description: "Open Commit, select files, review the diff, and enter a message.",
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

export function ProductHelpDialog({ onClose }: { readonly onClose: () => void }) {
  return (
    <Dialog
      aria-label="Help"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={620}
    >
      <section className={tw.productHelpDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Git Client Help"
        />
        <main>
          <p>
            Use the same project, editor, Log, Commit, Git, and Terminal workflow from one window.
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
