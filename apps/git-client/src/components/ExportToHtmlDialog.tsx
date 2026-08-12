import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import { RadioList, RadioListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { CheckboxInput } from "./ProductFormControls";

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
            if (await onExport(scope, includeLineNumbers, openInBrowser))
                onClose();
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
            <section
                className={`exportToHtmlDialog [display:grid] [grid-template-rows:auto_minmax(0,_1fr)_auto] [max-height:min(650px,_calc(100vh_-_70px))] [min-height:430px] [&>_main]:[display:flex] [&>_main]:[flex-direction:column] [&>_main]:[gap:14px] [&>_main]:[min-height:0] [&>_main]:[overflow:auto] [&>_main]:[padding:16px_20px] [&>_main_>_label]:[display:flex] [&>_main_>_label]:[flex-direction:column] [&>_main_>_label]:[font-weight:600] [&>_main_>_label]:[gap:5px] [&>_main_>_label_span]:[background:var(--muted)] [&>_main_>_label_span]:[border:1px_solid_var(--border)] [&>_main_>_label_span]:rounded-sm [&>_main_>_label_span]:[color:var(--muted-foreground)] [&>_main_>_label_span]:[font-weight:400] [&>_main_>_label_span]:[min-height:30px] [&>_main_>_label_span]:[padding:6px_8px] [&>_main_fieldset]:[border:1px_solid_var(--border)] [&>_main_fieldset]:rounded-lg [&>_main_fieldset]:[display:flex] [&>_main_fieldset]:[flex-direction:column] [&>_main_fieldset]:[gap:9px] [&>_main_fieldset]:[padding:10px_12px_12px] [&>_main_legend]:[color:var(--muted-foreground)] [&>_main_legend]:[padding:0_4px] [&>_main_p[role=alert]]:[color:var(--destructive)] [&>_main_p[role=alert]]:[margin:0] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[gap:8px] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:10px_12px] exportToHtmlDialog [&>_main_>_label_span]:rounded-sm [&>_main_fieldset]:rounded-lg`}
            >
                <DialogHeader
                    hasDivider
                    onOpenChange={(open) => !open && onClose()}
                    title="Export to HTML"
                />
                <main>
                    <RadioList
                        label="Export scope"
                        onChange={(value) => {
                            if (
                                value === "file" ||
                                value === "selection" ||
                                value === "directory"
                            )
                                setScope(value);
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
                    <div>
                        Output directory
                        <span>
                            The native directory picker opens after you choose
                            Export.
                        </span>
                    </div>
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
                        onClick={onClose}
                        type="button"
                        className={cn("h-8 px-3")}
                        variant="outline"
                        size="default"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void exportFiles()}
                        type="button"
                        disabled={exporting}
                        className={cn("h-8 px-3")}
                        variant="default"
                        size="default"
                    >
                        {exporting ? "Exporting…" : "Export"}
                    </Button>
                </footer>
            </section>
        </Dialog>
    );
}
