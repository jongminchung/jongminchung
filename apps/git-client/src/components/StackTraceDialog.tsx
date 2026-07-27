import { Button } from "@base-ui/react/button";
import { useMemo, useState } from "react";
import { stackTraceFrames, type StackTraceFrame } from "../domain/codeAnalysis";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ui";
import { List, ListItem } from "./ui";
import { TextArea } from "./ui";

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
