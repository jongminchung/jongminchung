import { Button } from "@base-ui/react/button";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";

export function ShareExistingRemotesDialog({
  onCancel,
  onOpenRemote,
  onShareAnyway,
  remotes,
  service,
}: {
  readonly onCancel: () => void;
  readonly onOpenRemote: (remote: string) => void;
  readonly onShareAnyway: () => void;
  readonly remotes: readonly string[];
  readonly service: "GitHub" | "GitLab";
}) {
  return (
    <Dialog
      aria-label={`Project Is Already on ${service}`}
      isOpen
      onOpenChange={(open) => !open && onCancel()}
      padding={0}
      purpose="required"
      width={510}
    >
      <section className={tw.shareExistingRemotesDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onCancel()}
          title={`Project Is Already on ${service}`}
        />
        <main>
          <Icon name="warning" size={28} />
          <section>
            <p>
              {remotes.length === 1
                ? `Remote is already on ${service}:`
                : `Following remotes are already on ${service}:`}
            </p>
            <List aria-label={`${service} remotes`} density="compact">
              {remotes.map((remote) => (
                <ListItem
                  id={`existing-host-remote-${remote}`}
                  key={remote}
                  label={remote}
                  onClick={() => onOpenRemote(remote)}
                  startContent={<Icon name="external" size={13} />}
                />
              ))}
            </List>
          </section>
        </main>
        <footer>
          <Button
            data-slot="button"
            onClick={onCancel}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
            )}
          >
            Cancel
          </Button>
          <Button
            data-slot="button"
            onClick={onShareAnyway}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            Share Anyway
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
