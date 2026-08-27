import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useState } from "react";
import { Dialog, DialogHeader } from "./ProductDialog";
import { TextArea } from "./ProductFormControls";

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
      <section
        className={`configurationFileDialog configurationFileDialog [display:grid] [max-height:min(700px,_calc(100vh_-_70px))] [grid-template-rows:auto_minmax(360px,_1fr)_auto] [&>_footer]:[display:flex] [&>_footer]:[justify-content:flex-end] [&>_footer]:[gap:8px] [&>_footer]:[padding:8px_10px] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_main]:[display:grid] [&>_main]:[min-height:0] [&>_main]:[gap:10px] [&>_main]:[padding:12px] [&>_main>_div[role=alert]]:[color:var(--destructive)] [&>_main>_p]:[margin:0] [&>_main>_p]:[color:var(--muted-foreground)]`}
      >
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title={title}
        />
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
            onClick={onClose}
            type="button"
            className={cn("h-8 px-3")}
            variant="outline"
            size="default"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            type="button"
            disabled={loading || saving}
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            {saving ? "Saving…" : "OK"}
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
