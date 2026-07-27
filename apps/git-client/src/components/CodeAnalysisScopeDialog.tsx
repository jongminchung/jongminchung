import { Button } from "@base-ui/react/button";
import { useState } from "react";
import type { CodeInspectionId } from "../domain/codeAnalysis";
import { cn } from "../lib/utils";
import { tw } from "../styles/tailwind";
import { Dialog, DialogHeader } from "./ui";
import { RadioList, RadioListItem } from "./ui";
import { Selector } from "./ui";

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
      <section className={tw.codeAnalysisScopeDialog}>
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
            onClick={() => void run()}
            type="button"
            disabled={running}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 h-8 px-3 border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
            )}
          >
            {running ? (mode === "cleanup" ? "Cleaning…" : "Inspecting…") : "OK"}
          </Button>
        </footer>
      </section>
    </Dialog>
  );
}
