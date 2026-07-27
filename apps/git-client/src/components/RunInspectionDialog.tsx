import { Button } from "@base-ui/react/button";
import { useMemo, useState } from "react";
import { CODE_INSPECTIONS, type CodeInspectionId } from "../domain/codeAnalysis";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";
import { TextInput } from "./ui";

export function RunInspectionDialog({
  onChoose,
  onClose,
}: {
  readonly onChoose: (inspectionId: CodeInspectionId) => void;
  readonly onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle === ""
      ? CODE_INSPECTIONS
      : CODE_INSPECTIONS.filter((inspection) =>
          `${inspection.name} ${inspection.description}`.toLocaleLowerCase().includes(needle),
        );
  }, [query]);

  return (
    <Dialog
      aria-label="Run Inspection by Name"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="info"
      width={600}
    >
      <section className={tw.runInspectionDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Run Inspection by Name"
        />
        <TextInput
          hasAutoFocus
          hasClear
          isLabelHidden
          label="Inspection name"
          onChange={setQuery}
          placeholder="Enter inspection name"
          value={query}
          width="100%"
        />
        <List aria-label="Inspections" density="compact" role="listbox">
          {filtered.map((inspection) => (
            <ListItem
              description={inspection.description}
              key={inspection.id}
              label={inspection.name}
              onClick={() => onChoose(inspection.id)}
              role="option"
              startContent={
                <Icon name={inspection.severity === "error" ? "warning" : "search"} size={14} />
              }
            />
          ))}
        </List>
        <footer>
          <Button
            data-slot="button"
            onClick={onClose}
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-border bg-card text-secondary-foreground shadow-xs hover:bg-accent active:bg-accent/80",
            )}
          >
            Cancel
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
