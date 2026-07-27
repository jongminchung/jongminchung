import { Button } from "@base-ui/react/button";
import { useState } from "react";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { CheckboxInput } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { RadioList, RadioListItem } from "./ui";

export type HtmlExportScope = "file" | "selection" | "directory";

export function ExportToHtmlDialog({
  directoryName,
  fileName,
  onClose,
  onExport,
  selectionAvailable,
}: {
  readonly directoryName: string;
  readonly fileName?: string;
  readonly onClose: () => void;
  readonly onExport: (
    scope: HtmlExportScope,
    includeLineNumbers: boolean,
    openInBrowser: boolean,
  ) => Promise<boolean>;
  readonly selectionAvailable: boolean;
}) {
  const [scope, setScope] = useState<HtmlExportScope>(
    selectionAvailable ? "selection" : fileName ? "file" : "directory",
  );
  const [includeLineNumbers, setIncludeLineNumbers] = useState(true);
  const [openInBrowser, setOpenInBrowser] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  const exportFiles = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    setError(undefined);
    try {
      if (await onExport(scope, includeLineNumbers, openInBrowser)) onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      aria-label="Export to HTML"
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width={560}
    >
      <section className={tw.exportToHtmlDialog}>
        <DialogHeader
          hasDivider
          onOpenChange={(open) => !open && onClose()}
          title="Export to HTML"
        />
        <main>
          <RadioList
            label="Export scope"
            onChange={(value) => {
              if (value === "file" || value === "selection" || value === "directory")
                setScope(value);
            }}
            value={scope}
          >
            <RadioListItem isDisabled={!fileName} label={`File ${fileName ?? ""}`} value="file" />
            <RadioListItem
              isDisabled={!selectionAvailable}
              label="Selected text"
              value="selection"
            />
            <RadioListItem label={`All files in directory ${directoryName}`} value="directory" />
          </RadioList>
          <label>
            Output directory
            <span>The native directory picker opens after you choose Export.</span>
          </label>
          <fieldset>
            <legend>Options</legend>
            <CheckboxInput
              label="Show line numbers"
              onChange={setIncludeLineNumbers}
              value={includeLineNumbers}
            />
            <CheckboxInput
              label="Open generated HTML in browser"
              onChange={setOpenInBrowser}
              value={openInBrowser}
            />
          </fieldset>
          {error && <p role="alert">{error}</p>}
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
            onClick={() => void exportFiles()}
            type="button"
            disabled={exporting}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            {exporting ? "Exporting…" : "Export"}
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
