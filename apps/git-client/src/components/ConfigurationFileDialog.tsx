import { Button } from "@base-ui/react/button";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ui";
import { TextArea } from "./ui";

export function ConfigurationFileDialog({
  description,
  load,
  onClose,
  save,
  title,
}: {
  readonly description: string;
  readonly load: () => Promise<string>;
  readonly onClose: () => void;
  readonly save: (content: string) => Promise<void>;
  readonly title: string;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const value = await load();
        if (active) setContent(value);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [load]);

  const submit = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await save(content);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      aria-label={title}
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width="min(720px, calc(100vw - 70px))"
    >
      <section className={tw.configurationFileDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <main>
          <p>{description}</p>
          <TextArea
            hasAutoFocus
            isDisabled={loading || saving}
            label="Configuration"
            onChange={setContent}
            rows={18}
            value={content}
            width="100%"
          />
          {error && <div role="alert">{error}</div>}
        </main>
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
          <Button
            data-slot="button"
            onClick={() => void submit()}
            type="button"
            disabled={loading || saving}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            {saving ? "Saving…" : "OK"}
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
