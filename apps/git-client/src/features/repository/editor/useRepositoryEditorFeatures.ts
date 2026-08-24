import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { exportHtmlFiles } from "../../../application/desktop/DesktopPort";
import type { GitSessionCapabilities } from "../../../application/git-session/ports/GitSessionCapabilities";
import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import type { CodeAnalysisScope } from "../../../components/CodeAnalysisScopeDialog";
import type { HtmlExportScope } from "../../../components/ExportToHtmlDialog";
import {
  cleanupText,
  inspectText,
  type CodeInspectionId,
  type CodeIssue,
  type StackTraceFrame,
} from "../../../domain/codeAnalysis";
import {
  replacementExpression,
  replaceProjectText,
  type ProjectSearchOptions,
} from "../../../domain/projectSearch";
import {
  nextScratchName,
  type ScratchFile,
  type ScratchLanguage,
} from "../../../domain/scratchFiles";
import type { RepositoryView } from "../../../domain/types";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import type { InspectorState } from "../state/workspaceTypes";

interface RepositoryEditorFeatureOptions {
  readonly inspector: InspectorState | undefined;
  readonly loadFile: GitSessionCapabilities["queries"]["readFile"];
  readonly openInspector: (next: InspectorState, keepOpen?: boolean) => void;
  readonly reload: GitSessionCapabilities["queries"]["reload"];
  readonly repository: RepositoryView;
  readonly writeWorkingTreeFile: GitSessionCapabilities["mutations"]["writeWorkingTreeFile"];
}

export function useRepositoryEditorFeatures({
  inspector,
  loadFile: sessionReadFile,
  openInspector,
  reload: sessionReload,
  repository,
  writeWorkingTreeFile: sessionWriteWorkingTreeFile,
}: RepositoryEditorFeatureOptions) {
  const {
    editorStatus,
    projectFiles,
    scratchFiles,
    setInspectionResults,
    setRepositoryViewMode,
    setScratchFileChooserOpen,
    setScratchFiles,
    setStackTraceOpen,
    setToast,
  } = useRepositoryWorkspaceStore(
    useShallow((state) => ({
      editorStatus: state.editorStatus,
      projectFiles: state.projectFiles,
      scratchFiles: state.scratchFiles,
      setInspectionResults: state.setInspectionResults,
      setRepositoryViewMode: state.setRepositoryViewMode,
      setScratchFileChooserOpen: state.setScratchFileChooserOpen,
      setScratchFiles: state.setScratchFiles,
      setStackTraceOpen: state.setStackTraceOpen,
      setToast: state.setToast,
    })),
  );

  const openScratchFile = useCallback(
    (scratch: ScratchFile, line?: number, column?: number): void => {
      setRepositoryViewMode("history");
      openInspector({
        revision: `scratch:${scratch.id}`,
        source: {
          kind: "revision",
          revision: `scratch:${scratch.id}`,
        },
        path: scratch.name,
        tab: "file",
        line,
        column,
        scratchId: scratch.id,
      });
    },
    [openInspector, setRepositoryViewMode],
  );
  const createScratchFile = useCallback(
    (language: ScratchLanguage): void => {
      const scratch: ScratchFile = {
        id: crypto.randomUUID(),
        name: nextScratchName(scratchFiles, language),
        languageId: language.id,
        content: "",
        updatedAtMs: Date.now(),
      };
      setScratchFiles((current) => [...current, scratch]);
      setScratchFileChooserOpen(false);
      openScratchFile(scratch);
    },
    [openScratchFile, scratchFiles, setScratchFiles, setScratchFileChooserOpen],
  );
  const exportToHtml = useCallback(
    async (
      scope: HtmlExportScope,
      includeLineNumbers: boolean,
      openInBrowser: boolean,
    ): Promise<boolean> => {
      const files: { readonly path: string; readonly content: string }[] = [];
      if (scope === "selection") {
        if (!editorStatus?.selectedText || !inspector?.path) {
          throw new Error("Select text in an editor before exporting.");
        }
        files.push({
          path: inspector.path,
          content: editorStatus.selectedText,
        });
      } else if (scope === "file") {
        if (!inspector?.path) throw new Error("Open a file before exporting.");
        const scratch = inspector.scratchId
          ? scratchFiles.find((file) => file.id === inspector.scratchId)
          : undefined;
        if (scratch) {
          files.push({
            path: scratch.name,
            content: scratch.content,
          });
        } else {
          const content = await sessionReadFile(
            inspector.source,
            inspector.path,
          );
          if (content.kind !== "text") {
            throw new Error("Only text files can be exported to HTML.");
          }
          files.push({
            path: inspector.path,
            content: content.content,
          });
        }
      } else {
        for (const path of projectFiles.slice(0, 1_000)) {
          const content = await sessionReadFile({ kind: "workingTree" }, path);
          if (content.kind === "text") {
            files.push({ path, content: content.content });
          }
        }
      }
      if (files.length === 0) {
        throw new Error("No text files are available to export.");
      }
      return exportHtmlFiles({
        files,
        includeLineNumbers,
        openInBrowser,
      });
    },
    [
      editorStatus?.selectedText,
      inspector,
      projectFiles,
      scratchFiles,
      sessionReadFile,
    ],
  );
  const replaceInProjectFiles = useCallback(
    async (
      paths: readonly string[],
      query: string,
      replacement: string,
      options: ProjectSearchOptions,
    ): Promise<number> => {
      const pending: {
        readonly path: string;
        readonly before: string;
        readonly after: string;
        readonly replacementCount: number;
      }[] = [];
      for (const path of new Set(paths)) {
        const content = await sessionReadFile({ kind: "workingTree" }, path);
        if (content.kind !== "text") continue;
        const expression = replacementExpression(query, options);
        const replacementCount = content.content.match(expression)?.length ?? 0;
        if (replacementCount === 0) continue;
        const after = replaceProjectText(
          content.content,
          query,
          replacement,
          options,
        );
        if (after !== content.content) {
          pending.push({
            path,
            before: content.content,
            after,
            replacementCount,
          });
        }
      }
      if (pending.length === 0) return 0;
      const written: (typeof pending)[number][] = [];
      try {
        for (const change of pending) {
          await sessionWriteWorkingTreeFile(
            change.path,
            change.after,
            "Replace in Files",
          );
          written.push(change);
        }
      } catch (reason) {
        const rollbackFailures: string[] = [];
        for (const change of [...written].reverse()) {
          try {
            await sessionWriteWorkingTreeFile(
              change.path,
              change.before,
              "Rollback Replace in Files",
            );
          } catch {
            rollbackFailures.push(change.path);
          }
        }
        const message =
          reason instanceof Error ? reason.message : String(reason);
        throw new Error(
          rollbackFailures.length === 0
            ? `${message} All completed replacements were rolled back.`
            : `${message} Rollback failed for: ${rollbackFailures.join(", ")}`,
        );
      }
      return pending.reduce(
        (total, change) => total + change.replacementCount,
        0,
      );
    },
    [sessionReadFile, sessionWriteWorkingTreeFile],
  );
  const codeAnalysisPaths = useCallback(
    (scope: CodeAnalysisScope): readonly string[] => {
      if (scope === "file") {
        return inspector?.path && inspector.scratchId === undefined
          ? [inspector.path]
          : [];
      }
      return projectFiles.slice(0, 1_000);
    },
    [inspector?.path, inspector?.scratchId, projectFiles],
  );
  const runCodeInspection = useCallback(
    async (
      scope: CodeAnalysisScope,
      inspectionId?: CodeInspectionId,
    ): Promise<void> => {
      const enabled = inspectionId
        ? new Set<CodeInspectionId>([inspectionId])
        : undefined;
      const issues: CodeIssue[] = [];
      if (scope === "file" && inspector?.scratchId) {
        const scratch = scratchFiles.find(
          (file) => file.id === inspector.scratchId,
        );
        if (scratch) {
          issues.push(
            ...inspectText(
              `Scratches/${scratch.name}`,
              scratch.content,
              enabled,
            ),
          );
        }
      } else {
        for (const path of codeAnalysisPaths(scope)) {
          const content = await sessionReadFile({ kind: "workingTree" }, path);
          if (content.kind === "text") {
            issues.push(...inspectText(path, content.content, enabled));
          }
        }
      }
      setInspectionResults({
        title: "Inspection Results",
        issues,
      });
    },
    [
      codeAnalysisPaths,
      inspector?.scratchId,
      scratchFiles,
      sessionReadFile,
      setInspectionResults,
    ],
  );
  const runCodeCleanup = useCallback(
    async (scope: CodeAnalysisScope): Promise<void> => {
      const saveTasks: Promise<void>[] = [];
      dispatchWorkbenchEvent("git-client:save-all", {
        tasks: saveTasks,
      });
      await Promise.all(saveTasks);
      if (scope === "file" && inspector?.scratchId) {
        setScratchFiles((current) =>
          current.map((file) =>
            file.id === inspector.scratchId
              ? { ...file, content: cleanupText(file.content) }
              : file,
          ),
        );
        setToast("Code cleanup completed");
        return;
      }
      const pending: {
        readonly path: string;
        readonly before: string;
        readonly after: string;
      }[] = [];
      for (const path of codeAnalysisPaths(scope)) {
        const content = await sessionReadFile({ kind: "workingTree" }, path);
        if (content.kind !== "text") continue;
        const after = cleanupText(content.content);
        if (after !== content.content) {
          pending.push({ path, before: content.content, after });
        }
      }
      if (pending.length === 0) {
        setToast("No cleanup changes were required");
        return;
      }
      const written: (typeof pending)[number][] = [];
      try {
        for (const change of pending) {
          await sessionWriteWorkingTreeFile(
            change.path,
            change.after,
            "Code Cleanup",
          );
          written.push(change);
        }
      } catch (reason) {
        const rollbackFailures: string[] = [];
        for (const change of [...written].reverse()) {
          try {
            await sessionWriteWorkingTreeFile(
              change.path,
              change.before,
              "Rollback Code Cleanup",
            );
          } catch {
            rollbackFailures.push(change.path);
          }
        }
        const message =
          reason instanceof Error ? reason.message : String(reason);
        throw new Error(
          rollbackFailures.length === 0
            ? `${message} Completed cleanup writes were rolled back.`
            : `${message} Rollback failed for: ${rollbackFailures.join(", ")}`,
        );
      }
      dispatchWorkbenchEvent("git-client:reload-editors", undefined);
      await sessionReload();
      setToast(`Cleaned ${pending.length.toLocaleString()} files`);
    },
    [
      codeAnalysisPaths,
      inspector?.scratchId,
      sessionReadFile,
      sessionReload,
      sessionWriteWorkingTreeFile,
      setScratchFiles,
      setToast,
    ],
  );
  const openCodeIssue = useCallback(
    (issue: CodeIssue): void => {
      const scratchName = issue.path.startsWith("Scratches/")
        ? issue.path.slice("Scratches/".length)
        : null;
      if (scratchName) {
        const scratch = scratchFiles.find((file) => file.name === scratchName);
        if (scratch) openScratchFile(scratch, issue.line, issue.column);
        return;
      }
      const path = projectFiles.find(
        (candidate) =>
          issue.path === candidate || issue.path.endsWith(`/${candidate}`),
      );
      if (!path) return;
      setRepositoryViewMode("history");
      openInspector({
        revision: repository.snapshot.headOid ?? "HEAD",
        source: { kind: "workingTree" },
        path,
        tab: "file",
        line: issue.line,
        column: issue.column,
      });
      setInspectionResults(undefined);
    },
    [
      openInspector,
      openScratchFile,
      projectFiles,
      repository.snapshot.headOid,
      scratchFiles,
      setInspectionResults,
      setRepositoryViewMode,
    ],
  );
  const openStackFrame = useCallback(
    (frame: StackTraceFrame): void => {
      if (!frame.path || !frame.line) return;
      const path = projectFiles.find(
        (candidate) =>
          frame.path === candidate || frame.path?.endsWith(`/${candidate}`),
      );
      if (!path) return;
      setStackTraceOpen(false);
      setRepositoryViewMode("history");
      openInspector({
        revision: repository.snapshot.headOid ?? "HEAD",
        source: { kind: "workingTree" },
        path,
        tab: "file",
        line: frame.line,
        column: 1,
      });
    },
    [
      openInspector,
      projectFiles,
      repository.snapshot.headOid,
      setRepositoryViewMode,
      setStackTraceOpen,
    ],
  );
  return {
    createScratchFile,
    exportToHtml,
    openCodeIssue,
    openScratchFile,
    openStackFrame,
    replaceInProjectFiles,
    runCodeCleanup,
    runCodeInspection,
  };
}
