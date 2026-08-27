import { Button } from "@jongminchung/ui/components/button";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Dialog } from "./ProductDialog";
import { CheckboxInput } from "./ProductFormControls";

export function TrustProjectDialog({
  parentName,
  projectName,
  onCancel,
  onPreview,
  onTrust,
}: {
  readonly parentName: string;
  readonly projectName: string;
  readonly onCancel: () => void;
  readonly onPreview: () => void;
  readonly onTrust: (trustParent: boolean) => void;
}) {
  const [trustParent, setTrustParent] = useState(false);
  const previewRef = useRef<HTMLButtonElement>(null);
  useEffect(() => previewRef.current?.focus(), []);
  const title = `Trust and Open Project '${projectName}'?`;

  return (
    <Dialog
      aria-label={title}
      isOpen
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      padding={0}
      purpose="form"
      width={637}
    >
      <section className="grid min-h-[192px] grid-cols-[32px_minmax(0,1fr)] gap-x-3 p-5">
        <Icon className="text-warning mt-0.5" name="warning" size={28} />
        <div className="flex min-w-0 flex-col">
          <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
          <p className="mt-2 mb-2 text-[13px] leading-[18px] text-muted-foreground">
            Git Client provides features that may execute potentially malicious
            code from this folder. If you don&apos;t trust the source, preview
            the project in the safe mode to only browse its code.
          </p>
          <CheckboxInput
            label={`Trust all projects in '${parentName}' folder`}
            onChange={setTrustParent}
            size="sm"
            value={trustParent}
          />
          <footer className="mt-auto flex justify-end gap-3 pt-3">
            <Button
              className="h-7 px-3"
              onClick={onCancel}
              type="button"
              variant="outline"
              size="sm"
            >
              Don&apos;t Open
            </Button>
            <Button
              className="h-7 px-3"
              onClick={onPreview}
              ref={previewRef}
              type="button"
              variant="outline"
              size="sm"
            >
              Preview in Safe Mode
            </Button>
            <Button
              className="h-7 px-3"
              onClick={() => onTrust(trustParent)}
              type="button"
              variant="default"
              size="sm"
            >
              Trust Project
            </Button>
          </footer>
        </div>
      </section>
    </Dialog>
  );
}
