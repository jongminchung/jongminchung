import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Button } from "./ui";
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
          <Button label="Close" onClick={onClose} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
