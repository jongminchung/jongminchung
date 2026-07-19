import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { List, ListItem } from "@astryxdesign/core/List";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMemo, useState } from "react";
import { CODE_INSPECTIONS, type CodeInspectionId } from "../domain/codeAnalysis";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";

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
    <Dialog aria-label="Run Inspection by Name" isOpen onOpenChange={(open) => !open && onClose()} padding={0} purpose="info" width={600}>
      <section className={tw.runInspectionDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title="Run Inspection by Name" />
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
              startContent={<Icon name={inspection.severity === "error" ? "warning" : "search"} size={14} />}
            />
          ))}
        </List>
        <footer><Button label="Cancel" onClick={onClose} variant="secondary" /></footer>
      </section>
    </Dialog>
  );
}
