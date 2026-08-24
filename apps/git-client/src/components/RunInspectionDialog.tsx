import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import {
  CODE_INSPECTIONS,
  type CodeInspectionId,
} from "../domain/codeAnalysis";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextInput } from "./ProductFormControls";

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
          `${inspection.name} ${inspection.description}`
            .toLocaleLowerCase()
            .includes(needle),
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
      <section
        className={`runInspectionDialog [display:grid] [grid-template-rows:auto_auto_minmax(260px,_1fr)_auto] [height:min(580px,_calc(100vh_-_80px))] [&>_[data-slot=text-input]]:[margin:10px_12px_5px] [&>_div[role=listbox]]:[min-height:0] [&>_div[role=listbox]]:[overflow:auto] [&>_div[role=listbox]]:[padding:5px_7px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:8px_10px] runInspectionDialog`}
      >
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
              aria-selected={false}
              role="option"
              startContent={
                <Icon
                  name={inspection.severity === "error" ? "warning" : "search"}
                  size={14}
                />
              }
              tabIndex={-1}
            />
          ))}
        </List>
        <footer>
          <Button
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
