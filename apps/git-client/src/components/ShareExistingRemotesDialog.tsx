import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Button } from "./ui";
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
          <Button label="Cancel" onClick={onCancel} variant="secondary" />
          <Button label="Share Anyway" onClick={onShareAnyway} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
