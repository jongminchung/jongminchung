import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { useState } from "react";
import { tw } from "../styles/tailwind";

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
              if (value === "file" || value === "selection" || value === "directory") setScope(value);
            }}
            value={scope}
          >
            <RadioListItem
              isDisabled={!fileName}
              label={`File ${fileName ?? ""}`}
              value="file"
            />
            <RadioListItem
              isDisabled={!selectionAvailable}
              label="Selected text"
              value="selection"
            />
            <RadioListItem
              label={`All files in directory ${directoryName}`}
              value="directory"
            />
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
          <Button label="Cancel" onClick={onClose} variant="secondary" />
          <Button
            isDisabled={exporting}
            label={exporting ? "Exporting…" : "Export"}
            onClick={() => void exportFiles()}
            variant="primary"
          />
        </footer>
      </section>
    </Dialog>
  );
}
