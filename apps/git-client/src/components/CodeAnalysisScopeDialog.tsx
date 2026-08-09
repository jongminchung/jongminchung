import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import type { CodeInspectionId } from "../domain/codeAnalysis";
import { RadioList, RadioListItem } from "./ProductCollections";
import { Dialog, DialogHeader } from "./ProductDialog";
import { Selector } from "./ProductFormControls";

export type CodeAnalysisScope = "project" | "file";

export function CodeAnalysisScopeDialog({
  currentFile,
  inspectionId,
  mode,
  onClose,
  onRun,
}: {
  readonly currentFile: string | null;
  readonly inspectionId?: CodeInspectionId;
  readonly mode: "inspect" | "cleanup";
  readonly onClose: () => void;
  readonly onRun: (scope: CodeAnalysisScope) => Promise<void>;
}) {
  const [scope, setScope] = useState<CodeAnalysisScope>(currentFile ? "file" : "project");
  const [profile, setProfile] = useState("project-default");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const title =
    mode === "cleanup" ? "Code Cleanup" : inspectionId ? "Run Inspection" : "Inspection";
  const run = async (): Promise<void> => {
    if (running) return;
    setRunning(true);
    setError(undefined);
    try {
      await onRun(scope);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog
      aria-label={title}
      isOpen
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width={560}
    >
      <section
        className={`codeAnalysisScopeDialog [display:grid] [grid-template-rows:auto_minmax(0,_1fr)_auto] [&>_main]:[display:grid] [&>_main]:[gap:16px] [&>_main]:[padding:18px_20px] [&>_main_p]:[color:var(--destructive)] [&>_main_p]:[margin:0] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:flex] [&>_footer]:[gap:8px] [&>_footer]:[justify-content:flex-end] [&>_footer]:[padding:9px_11px] codeAnalysisScopeDialog`}
      >
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <main>
          <RadioList
            label="Scope"
            onChange={(value) => {
              if (value === "project" || value === "file") setScope(value);
            }}
            value={scope}
          >
            <RadioListItem label="Whole project" value="project" />
            <RadioListItem
              isDisabled={!currentFile}
              label={currentFile ? `File '${currentFile}'` : "Current file"}
              value="file"
            />
          </RadioList>
          <Selector
            label={mode === "cleanup" ? "Cleanup profile" : "Inspection profile"}
            onChange={setProfile}
            options={[
              {
                label: "Project Default",
                value: "project-default",
              },
            ]}
            value={profile}
            width="100%"
          />
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
            onClick={() => void run()}
            type="button"
            disabled={running}
            className={cn("h-8 px-3")}
            variant="default"
            size="default"
          >
            {running ? (mode === "cleanup" ? "Cleaning…" : "Inspecting…") : "OK"}
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
