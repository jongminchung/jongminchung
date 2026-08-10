import { parseOfflineInspectionXml } from "../../domain/codeAnalysis";
import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../../domain/commands";
import { selectOfflineInspectionFiles } from "../../platform/codeAnalysis";
import type { RepositoryCommandContext } from "./repositoryCommandTypes";

export type SearchAnalysisCommandPort = Pick<
  RepositoryCommandContext,
  | "dispatchEditorSearch"
  | "editorActionAvailability"
  | "editorStatus"
  | "focusCurrentSearch"
  | "inspector"
  | "navigateInspectorHistory"
  | "navigationHistory"
  | "navigationIndex"
  | "onOpenSettings"
  | "openPaletteFor"
  | "runCodeCleanup"
  | "setCodeAnalysisRequest"
  | "setInspectionResults"
  | "setProjectSearchInitialQuery"
  | "setProjectSearchSurface"
  | "setRunInspectionOpen"
  | "setStackTraceOpen"
>;

export function createSearchAnalysisCommands(
  context: SearchAnalysisCommandPort,
): readonly CommandDefinition[] {
  const {
    dispatchEditorSearch,
    editorActionAvailability,
    editorStatus,
    focusCurrentSearch,
    inspector,
    navigateInspectorHistory,
    navigationHistory,
    navigationIndex,
    onOpenSettings,
    openPaletteFor,
    runCodeCleanup,
    setCodeAnalysisRequest,
    setInspectionResults,
    setProjectSearchInitialQuery,
    setProjectSearchSurface,
    setRunInspectionOpen,
    setStackTraceOpen,
  } = context;
  return [
    commandDefinition("view.search", focusCurrentSearch),
    commandDefinition(
      "view.searchInSelection",
      () => {
        dispatchEditorSearch("selectionScope");
      },
      () =>
        window.getSelection()?.toString() || editorStatus?.selectedText
          ? COMMAND_ENABLED
          : commandDisabled("Select text in a file editor first."),
    ),
    commandDefinition(
      "view.findWordAtCaret",
      () => {
        dispatchEditorSearch("nextWord");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition(
      "view.findPrevWordAtCaret",
      () => {
        dispatchEditorSearch("previousWord");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition("view.findNext", () => {
      if (dispatchEditorSearch("next")) return;
      window.dispatchEvent(
        new CustomEvent("git-client:find", {
          detail: { direction: 1 },
        }),
      );
    }),
    commandDefinition("view.findPrevious", () => {
      if (dispatchEditorSearch("previous")) return;
      window.dispatchEvent(
        new CustomEvent("git-client:find", {
          detail: { direction: -1 },
        }),
      );
    }),
    commandDefinition("view.recentLocations", () => openPaletteFor("recentLocations")),
    commandDefinition("view.recentFiles", () => openPaletteFor("recentFiles")),
    commandDefinition("view.recentlyChangedFiles", () => openPaletteFor("recentlyChangedFiles")),
    commandDefinition("navigate.file", () => openPaletteFor("files")),
    commandDefinition("navigate.class", () => {
      setProjectSearchInitialQuery("");
      setProjectSearchSurface("class");
    }),
    commandDefinition("navigate.symbol", () => {
      setProjectSearchInitialQuery("");
      setProjectSearchSurface("symbol");
    }),
    commandDefinition("navigate.text", () => {
      setProjectSearchInitialQuery("");
      setProjectSearchSurface("text");
    }),
    commandDefinition(
      "navigate.back",
      () => navigateInspectorHistory(-1),
      () =>
        navigationIndex > 0 ? COMMAND_ENABLED : commandDisabled("There is no previous location."),
    ),
    commandDefinition(
      "navigate.forward",
      () => navigateInspectorHistory(1),
      () =>
        navigationIndex + 1 < navigationHistory.current.length
          ? COMMAND_ENABLED
          : commandDisabled("There is no next location."),
    ),
    ...(
      [
        ["navigate.declaration", "definition"],
        ["navigate.implementation", "implementation"],
        ["navigate.relatedSymbol", "related"],
        ["navigate.fileStructure", "structure"],
        ["navigate.typeHierarchy", "typeHierarchy"],
        ["navigate.callHierarchy", "callHierarchy"],
      ] as const
    ).map(([id, surface]) =>
      commandDefinition(
        id,
        () => {
          setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
          setProjectSearchSurface(surface);
        },
        () => editorActionAvailability(false),
      ),
    ),
    commandDefinition("view.findInFiles", () => {
      setProjectSearchInitialQuery("");
      setProjectSearchSurface("find");
    }),
    commandDefinition(
      "edit.findUsages",
      () => {
        setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
        setProjectSearchSurface("usages");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition("edit.findUsagesSettings", onOpenSettings, () =>
      editorActionAvailability(false),
    ),
    commandDefinition(
      "edit.findUsagesFile",
      () => {
        setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
        setProjectSearchSurface("usagesFile");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition("code.inspect", () => setCodeAnalysisRequest({ mode: "inspect" })),
    commandDefinition("code.cleanup", () => setCodeAnalysisRequest({ mode: "cleanup" })),
    commandDefinition("code.silentCleanup", () =>
      runCodeCleanup(inspector?.path ? "file" : "project"),
    ),
    commandDefinition("code.runInspection", () => setRunInspectionOpen(true)),
    commandDefinition("code.viewOfflineInspection", async () => {
      const files = await selectOfflineInspectionFiles();
      if (files === null) return;
      const issues = files.flatMap((file) => parseOfflineInspectionXml(file.name, file.content));
      setInspectionResults({
        title: "Offline View",
        issues,
      });
    }),
    commandDefinition("code.analyzeStackTrace", () => setStackTraceOpen(true)),
  ];
}
