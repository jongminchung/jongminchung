import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../../domain/commands";
import { DEFAULT_PRODUCT_SETTINGS } from "../../domain/productSettings";
import { getElectronFullScreen, setElectronFullScreen } from "../../platform/electronActions";
import type { WorkspaceCommandContext } from "./workspaceCommandTypes";

const STATUS_BAR_WIDGET_COMMANDS = [
  ["view.statusWidgetStatusText", "statusText"],
  ["view.statusWidgetFileSystemSync", "fileSystemSync"],
  ["view.statusWidgetAggregator", "aggregator"],
  ["view.statusWidgetGridPosition", "gridPosition"],
  ["view.statusWidgetLineColumn", "lineColumn"],
  ["view.statusWidgetLanguageServices", "languageServices"],
  ["view.statusWidgetLineSeparator", "lineSeparator"],
  ["view.statusWidgetFileEncoding", "fileEncoding"],
  ["view.statusWidgetPowerSaveMode", "powerSaveMode"],
  ["view.statusWidgetEditorSelectionMode", "editorSelectionMode"],
  ["view.statusWidgetIndentation", "indentation"],
  ["view.statusWidgetReadOnlyAttribute", "readOnlyAttribute"],
  ["view.statusWidgetMemoryIndicator", "memoryIndicator"],
] as const satisfies readonly (readonly [
  `${string}.${string}`,
  import("../../domain/productSettings").StatusBarWidget,
])[];

export function createAppearanceCommands(
  context: Pick<
    WorkspaceCommandContext,
    | "dialog"
    | "presentationPreviousFullScreen"
    | "productSettings"
    | "session"
    | "setProductSettings"
    | "setQuickSwitchSchemeOpen"
    | "zenPreviousFullScreen"
  >,
): readonly CommandDefinition[] {
  const {
    dialog,
    presentationPreviousFullScreen,
    productSettings,
    session,
    setProductSettings,
    setQuickSwitchSchemeOpen,
    zenPreviousFullScreen,
  } = context;
  return [
    {
      ...commandDefinition("window.autoShowProcesses", () =>
        setProductSettings((current) => ({
          ...current,
          processWindowAutoShow: !current.processWindowAutoShow,
        })),
      ),
      checked: () => productSettings.processWindowAutoShow,
    },
    {
      ...commandDefinition("view.scrollSearchResults", () =>
        setProductSettings((current) => ({
          ...current,
          scrollToSearchResults: !current.scrollToSearchResults,
        })),
      ),
      checked: () => productSettings.scrollToSearchResults,
    },
    {
      ...commandDefinition("view.compactMode", () => {
        window.dispatchEvent(
          new CustomEvent("git-client:product-settings-request", {
            detail: { kind: "toggleCompact" },
          }),
        );
      }),
      checked: () => productSettings.compactMode,
    },
    {
      ...commandDefinition("view.presentationMode", async () => {
        const entering = !productSettings.presentationMode;
        if (entering) {
          presentationPreviousFullScreen.current = await getElectronFullScreen();
        }
        await setElectronFullScreen(entering ? true : presentationPreviousFullScreen.current);
        setProductSettings((current) => ({
          ...current,
          presentationMode: entering,
        }));
      }),
      label: productSettings.presentationMode
        ? "Exit Presentation Mode"
        : "Enter Presentation Mode",
      checked: () => productSettings.presentationMode,
    },
    {
      ...commandDefinition("view.distractionFreeMode", () =>
        setProductSettings((current) => ({
          ...current,
          distractionFreeMode: !current.distractionFreeMode,
          zenMode: current.distractionFreeMode ? false : current.zenMode,
        })),
      ),
      label: productSettings.distractionFreeMode
        ? "Exit Distraction Free Mode"
        : "Enter Distraction Free Mode",
      checked: () => productSettings.distractionFreeMode,
    },
    {
      ...commandDefinition("view.zenMode", async () => {
        const entering = !productSettings.zenMode;
        if (entering) {
          zenPreviousFullScreen.current = await getElectronFullScreen();
        }
        await setElectronFullScreen(entering ? true : zenPreviousFullScreen.current);
        setProductSettings((current) => ({
          ...current,
          distractionFreeMode: entering,
          zenMode: entering,
        }));
      }),
      label: productSettings.zenMode ? "Exit Zen Mode" : "Enter Zen Mode",
      checked: () => productSettings.zenMode,
    },
    {
      ...commandDefinition("view.zoomIde", async () => {
        const value = await dialog.input({
          title: "Zoom IDE",
          label: "Zoom percentage",
          description: "Available values: 100, 125, or 150.",
          initialValue: String(productSettings.zoom),
          confirmLabel: "Apply",
          validate: (candidate) =>
            candidate === "100" || candidate === "125" || candidate === "150"
              ? null
              : "Choose 100, 125, or 150.",
        });
        if (value === null) return;
        setProductSettings((current) => ({
          ...current,
          zoom: Number(value) as 100 | 125 | 150,
        }));
      }),
      label: `Zoom IDE (Current: ${productSettings.zoom}%)…`,
    },
    commandDefinition("view.quickSwitchScheme", () => setQuickSwitchSchemeOpen(true)),
    commandDefinition(
      "view.resetEditorFontSize",
      () =>
        setProductSettings((current) => ({
          ...current,
          editorFontSize: DEFAULT_PRODUCT_SETTINGS.editorFontSize,
        })),
      () =>
        session.activeTab.kind === "repository"
          ? COMMAND_ENABLED
          : commandDisabled("Open a project to reset editor fonts."),
    ),
    {
      ...commandDefinition(
        "view.bidiContent",
        () =>
          setProductSettings((current) => ({
            ...current,
            bidiTextDirection: "content",
          })),
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to set text direction."),
      ),
      checked: () => productSettings.bidiTextDirection === "content",
    },
    {
      ...commandDefinition(
        "view.bidiLtr",
        () =>
          setProductSettings((current) => ({
            ...current,
            bidiTextDirection: "ltr",
          })),
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to set text direction."),
      ),
      checked: () => productSettings.bidiTextDirection === "ltr",
    },
    {
      ...commandDefinition(
        "view.bidiRtl",
        () =>
          setProductSettings((current) => ({
            ...current,
            bidiTextDirection: "rtl",
          })),
        () =>
          session.activeTab.kind === "repository"
            ? COMMAND_ENABLED
            : commandDisabled("Open a project to set text direction."),
      ),
      checked: () => productSettings.bidiTextDirection === "rtl",
    },
    {
      ...commandDefinition("view.presentationAssistant", () =>
        setProductSettings((current) => ({
          ...current,
          presentationAssistant: !current.presentationAssistant,
        })),
      ),
      checked: () => productSettings.presentationAssistant,
    },
    {
      ...commandDefinition("view.powerSaveMode", () =>
        setProductSettings((current) => ({
          ...current,
          powerSaveMode: !current.powerSaveMode,
        })),
      ),
      checked: () => productSettings.powerSaveMode,
    },
    {
      ...commandDefinition("view.toolbar", () =>
        setProductSettings((current) => ({
          ...current,
          toolbarVisible: !current.toolbarVisible,
        })),
      ),
      checked: () => productSettings.toolbarVisible,
    },
    {
      ...commandDefinition("view.navigationBarTop", () =>
        setProductSettings((current) => ({
          ...current,
          navigationBar: "top",
        })),
      ),
      checked: () => productSettings.navigationBar === "top",
    },
    {
      ...commandDefinition("view.navigationBarStatus", () =>
        setProductSettings((current) => ({
          ...current,
          navigationBar: "status",
        })),
      ),
      checked: () => productSettings.navigationBar === "status",
    },
    {
      ...commandDefinition("view.navigationBarHidden", () =>
        setProductSettings((current) => ({
          ...current,
          navigationBar: "hidden",
        })),
      ),
      checked: () => productSettings.navigationBar === "hidden",
    },
    {
      ...commandDefinition("view.navigationBarMembers", () =>
        setProductSettings((current) => ({
          ...current,
          navigationBarShowMembers: !current.navigationBarShowMembers,
        })),
      ),
      checked: () => productSettings.navigationBarShowMembers,
    },
    {
      ...commandDefinition("view.toolWindowBars", () =>
        setProductSettings((current) => ({
          ...current,
          toolWindowBarsVisible: !current.toolWindowBarsVisible,
        })),
      ),
      checked: () => productSettings.toolWindowBarsVisible,
    },
    {
      ...commandDefinition("view.statusBar", () =>
        setProductSettings((current) => ({
          ...current,
          statusBarVisible: !current.statusBarVisible,
        })),
      ),
      checked: () => productSettings.statusBarVisible,
    },
    ...STATUS_BAR_WIDGET_COMMANDS.map(([id, widget]) => ({
      ...commandDefinition(id, () =>
        setProductSettings((current) => ({
          ...current,
          statusBarWidgets: {
            ...current.statusBarWidgets,
            [widget]: !current.statusBarWidgets[widget],
          },
        })),
      ),
      checked: () => productSettings.statusBarWidgets[widget],
    })),
  ];
}
