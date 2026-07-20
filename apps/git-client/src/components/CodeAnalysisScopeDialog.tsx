import { useState } from "react";
import type { CodeInspectionId } from "../domain/codeAnalysis";
import { tw } from "../styles/tailwind";
import { Button } from "./ui";
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
            options={[{ label: "Project Default", value: "project-default" }]}
            value={profile}
            width="100%"
          />
          {error && <p role="alert">{error}</p>}
        </main>
        <footer>
          <Button label="Cancel" onClick={onClose} variant="secondary" />
          <Button
            isDisabled={running}
            label={running ? (mode === "cleanup" ? "Cleaning…" : "Inspecting…") : "OK"}
            onClick={() => void run()}
            variant="primary"
          />
        </footer>
      </section>
    </Dialog>
  );
}
