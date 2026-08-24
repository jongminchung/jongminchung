import { selectOfflineInspectionFiles } from "../../../application/desktop/DesktopPort";
import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import { parseOfflineInspectionXml } from "../../../domain/codeAnalysis";
import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../../../domain/commands";
export interface SearchAnalysisCommandPort {
  readonly dispatchEditorSearch: (
    action: import("../../../components/codeMirrorSearch").EditorSearchAction,
  ) => boolean;
  readonly editorActionAvailability: (
    requiresEditable: boolean,
  ) => ReturnType<CommandDefinition["availability"]>;
  readonly editorStatus:
    | import("../state/workspaceTypes").EditorStatus
    | undefined;
  readonly focusCurrentSearch: () => void;
  readonly inspector:
    | import("../state/workspaceTypes").InspectorState
    | undefined;
  readonly navigateInspectorHistory: (offset: -1 | 1) => void;
  readonly navigationHistory: import("react").RefObject<
    readonly import("../state/workspaceTypes").InspectorState[]
  >;
  readonly navigationIndex: number;
  readonly onOpenSettings: () => void;
  readonly openPaletteFor: (
    scope: import("../../../domain/commands").PaletteScope,
  ) => void;
  readonly runCodeCleanup: (
    scope: import("../../../components/CodeAnalysisScopeDialog").CodeAnalysisScope,
  ) => Promise<void>;
  readonly setCodeAnalysisRequest: (
    value: import("react").SetStateAction<
      | {
          readonly mode: "inspect" | "cleanup";
          readonly inspectionId?: import("../../../domain/codeAnalysis").CodeInspectionId;
        }
      | undefined
    >,
  ) => void;
  readonly setInspectionResults: (
    value: import("react").SetStateAction<
      | {
          readonly title: string;
          readonly issues: readonly import("../../../domain/codeAnalysis").CodeIssue[];
        }
      | undefined
    >,
  ) => void;
  readonly setProjectSearchInitialQuery: (
    value: import("react").SetStateAction<string>,
  ) => void;
  readonly setProjectSearchSurface: (
    value: import("react").SetStateAction<
      | import("../../../components/ProjectSearchDialog").ProjectSearchSurface
      | undefined
    >,
  ) => void;
  readonly setRunInspectionOpen: (
    value: import("react").SetStateAction<boolean>,
  ) => void;
  readonly setStackTraceOpen: (
    value: import("react").SetStateAction<boolean>,
  ) => void;
}

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
      dispatchWorkbenchEvent("git-client:find", { direction: 1 });
    }),
    commandDefinition("view.findPrevious", () => {
      if (dispatchEditorSearch("previous")) return;
      dispatchWorkbenchEvent("git-client:find", { direction: -1 });
    }),
    commandDefinition("view.recentLocations", () =>
      openPaletteFor("recentLocations"),
    ),
    commandDefinition("view.recentFiles", () => openPaletteFor("recentFiles")),
    commandDefinition("view.recentlyChangedFiles", () =>
      openPaletteFor("recentlyChangedFiles"),
    ),
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
        navigationIndex > 0
          ? COMMAND_ENABLED
          : commandDisabled("There is no previous location."),
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
    commandDefinition("code.inspect", () =>
      setCodeAnalysisRequest({ mode: "inspect" }),
    ),
    commandDefinition("code.cleanup", () =>
      setCodeAnalysisRequest({ mode: "cleanup" }),
    ),
    commandDefinition("code.silentCleanup", () =>
      runCodeCleanup(inspector?.path ? "file" : "project"),
    ),
    commandDefinition("code.runInspection", () => setRunInspectionOpen(true)),
    commandDefinition("code.viewOfflineInspection", async () => {
      const files = await selectOfflineInspectionFiles();
      if (files === null) return;
      const issues = files.flatMap((file) =>
        parseOfflineInspectionXml(file.name, file.content),
      );
      setInspectionResults({
        title: "Offline View",
        issues,
      });
    }),
    commandDefinition("code.analyzeStackTrace", () => setStackTraceOpen(true)),
  ];
}
