import { Button } from "@base-ui/react/button";
import { cn } from "../lib/utils";
import type { DiagnosticPathKind } from "../shared/contracts/ipc";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";

const FILES: readonly Readonly<{
  description: string;
  kind: DiagnosticPathKind;
  label: string;
}>[] = [
  {
    kind: "settings",
    label: "Configuration",
    description: "Settings and local application data",
  },
  {
    kind: "logs",
    label: "Logs",
    description: "Application and diagnostic logs",
  },
  {
    kind: "caches",
    label: "Caches",
    description: "Electron session and renderer caches",
  },
  {
    kind: "crashDumps",
    label: "Crash Dumps",
    description: "Native crash reports",
  },
  {
    kind: "customProperties",
    label: "Custom Properties",
    description: "Git Client property overrides",
  },
  {
    kind: "vmOptions",
    label: "Custom VM Options",
    description: "Allowlisted renderer memory options",
  },
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
