import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";

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
            onClick={onCancel}
            type="button"
            className={cn("h-8 px-3")}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
          <Button
            onClick={onShareAnyway}
            type="button"
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Share Anyway
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
