import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useEffect, useState } from "react";
import { tw } from "../styles/tailwind";

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
          <Button label="Cancel" onClick={onClose} variant="secondary" />
          <Button
            isDisabled={loading || saving}
            label={saving ? "Saving…" : "OK"}
            onClick={() => void submit()}
            variant="primary"
          />
        </footer>
      </section>
    </Dialog>
  );
}
