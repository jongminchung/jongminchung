import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useState } from "react";
import { stackTraceFrames, type StackTraceFrame } from "../domain/codeAnalysis";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { List, ListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextArea } from "./ProductFormControls";

export function StackTraceDialog({
  onClose,
  onOpenFrame,
}: {
  readonly onClose: () => void;
  readonly onOpenFrame: (frame: StackTraceFrame) => void;
}) {
  const [value, setValue] = useState("");
  const frames = useMemo(() => stackTraceFrames(value), [value]);
  return (
    <Dialog
      aria-label="Analyze Stack Trace"
      isOpen
      maxHeight="min(720px, calc(100vh - 70px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width="min(820px, calc(100vw - 70px))"
    >
      <section className={tw.stackTraceDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Analyze Stack Trace"
        />
        <main>
          <TextArea
            hasAutoFocus
            label="Stack trace or thread dump"
            onChange={setValue}
            placeholder="Put a stack trace or a complete thread dump here"
            rows={12}
            value={value}
            width="100%"
          />
          <List aria-label="Stack frames" density="compact" role="listbox">
            {frames.map((frame, index) => (
              <ListItem
                description={
                  frame.path && frame.line ? `${frame.path}:${frame.line}` : "No source location"
                }
                aria-disabled={!frame.path || !frame.line}
                key={`${frame.text}:${index}`}
                label={frame.text.trim()}
                onClick={frame.path && frame.line ? () => onOpenFrame(frame) : undefined}
                role="option"
                startContent={<Icon name="file" size={14} />}
              />
            ))}
          </List>
        </main>
        <footer>
          <Button
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            Close
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
