import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import type { DiagnosticPathKind } from "../shared/contracts/ipc";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

const FILES: readonly Readonly<{
  description: string;
  kind: DiagnosticPathKind;
  label: string;
}>[] = [
  { kind: "settings", label: "Configuration", description: "Settings and local application data" },
  { kind: "logs", label: "Logs", description: "Application and diagnostic logs" },
  { kind: "caches", label: "Caches", description: "Electron session and renderer caches" },
  { kind: "crashDumps", label: "Crash Dumps", description: "Native crash reports" },
  { kind: "customProperties", label: "Custom Properties", description: "Git Client property overrides" },
  { kind: "vmOptions", label: "Custom VM Options", description: "Allowlisted renderer memory options" },
];

export function SpecialFilesDialog({
  onClose,
  onReveal,
}: {
  readonly onClose: () => void;
  readonly onReveal: (kind: DiagnosticPathKind) => Promise<void>;
}) {
  return (
    <Dialog
      aria-label="Special Files and Folders"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={560}
    >
      <section className={tw.specialFilesDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Special Files and Folders"
        />
        <List aria-label="Special files and folders" density="compact" role="list">
          {FILES.map((file) => (
            <ListItem
              description={file.description}
              endContent={<Icon name="external" size={14} />}
              key={file.kind}
              label={file.label}
              onClick={() => void onReveal(file.kind)}
              role="listitem"
              startContent={<Icon name="folder" size={14} />}
            />
          ))}
        </List>
        <footer>
          <Button label="Close" onClick={onClose} variant="primary" />
        </footer>
      </section>
    </Dialog>
  );
}
