export const PRODUCT_SETTINGS_KEY = "productSettings";

export type ProductZoom = 100 | 125 | 150;
export type EditorColorScheme = "themeDefault" | "light" | "dark" | "highContrast";
export type ProductLanguage = "English";
export type ProductRegion = "notSpecified" | "asiaExceptChinaMainland";
export type NavigationBarLocation = "top" | "status" | "hidden";
export type BidiTextDirection = "content" | "ltr" | "rtl";
export type StatusBarWidget =
  | "statusText"
  | "fileSystemSync"
  | "aggregator"
  | "gridPosition"
  | "lineColumn"
  | "languageServices"
  | "lineSeparator"
  | "fileEncoding"
  | "powerSaveMode"
  | "editorSelectionMode"
  | "indentation"
  | "readOnlyAttribute"
  | "memoryIndicator";
export type ProductKeymapPreset =
  | "macOS"
  | "Emacs"
  | "IntelliJ IDEA Classic"
  | "macOS System Shortcuts"
  | "Sublime Text"
  | "Sublime Text (macOS)";

export interface ProductSettings {
  readonly compactMode: boolean;
  readonly ideFontSize: number;
  readonly editorFontSize: number;
  readonly zoom: ProductZoom;
  readonly presentationMode: boolean;
  readonly distractionFreeMode: boolean;
  readonly zenMode: boolean;
  readonly presentationAssistant: boolean;
  readonly powerSaveMode: boolean;
  readonly toolbarVisible: boolean;
  readonly navigationBar: NavigationBarLocation;
  readonly navigationBarShowMembers: boolean;
  readonly toolWindowBarsVisible: boolean;
  readonly statusBarVisible: boolean;
  readonly statusBarWidgets: Readonly<Record<StatusBarWidget, boolean>>;
  readonly adjustRedGreenVision: boolean;
  readonly showNotifications: boolean;
  readonly showShortcutConflictWarning: boolean;
  readonly keymapPreset: ProductKeymapPreset;
  readonly keymapOverrides: Readonly<Record<string, string | null>>;
  readonly bidiTextDirection: BidiTextDirection;
  readonly scrollToSearchResults: boolean;
  readonly processWindowAutoShow: boolean;
  readonly editorColorScheme: EditorColorScheme;
  readonly language: ProductLanguage;
  readonly region: ProductRegion;
}

export const DEFAULT_STATUS_BAR_WIDGETS: Readonly<Record<StatusBarWidget, boolean>> = {
  statusText: true,
  fileSystemSync: true,
  aggregator: true,
  gridPosition: true,
  lineColumn: true,
  languageServices: true,
  lineSeparator: true,
  fileEncoding: true,
  powerSaveMode: true,
  editorSelectionMode: true,
  indentation: true,
  readOnlyAttribute: true,
  memoryIndicator: false,
};

export const DEFAULT_PRODUCT_SETTINGS: ProductSettings = {
  compactMode: false,
  ideFontSize: 13,
  editorFontSize: 13,
  zoom: 100,
  presentationMode: false,
  distractionFreeMode: false,
  zenMode: false,
  presentationAssistant: false,
  powerSaveMode: false,
  toolbarVisible: true,
  navigationBar: "status",
  navigationBarShowMembers: false,
  toolWindowBarsVisible: true,
  statusBarVisible: true,
  statusBarWidgets: DEFAULT_STATUS_BAR_WIDGETS,
  adjustRedGreenVision: false,
  showNotifications: true,
  showShortcutConflictWarning: true,
  keymapPreset: "macOS",
  keymapOverrides: {},
  bidiTextDirection: "content",
  scrollToSearchResults: true,
  processWindowAutoShow: false,
  editorColorScheme: "themeDefault",
  language: "English",
  region: "asiaExceptChinaMainland",
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isProductKeymapPreset(value: unknown): value is ProductKeymapPreset {
  return (
    value === "macOS" ||
    value === "Emacs" ||
    value === "IntelliJ IDEA Classic" ||
    value === "macOS System Shortcuts" ||
    value === "Sublime Text" ||
    value === "Sublime Text (macOS)"
  );
}

export function isEditorColorScheme(value: unknown): value is EditorColorScheme {
  return (
    value === "themeDefault" || value === "light" || value === "dark" || value === "highContrast"
  );
}

export function isProductRegion(value: unknown): value is ProductRegion {
  return value === "notSpecified" || value === "asiaExceptChinaMainland";
}

export function parseProductSettings(value: unknown): ProductSettings {
  if (!isRecord(value)) return DEFAULT_PRODUCT_SETTINGS;
  const zoom = value.zoom === 125 || value.zoom === 150 ? value.zoom : 100;
  const navigationBar: NavigationBarLocation =
    value.navigationBar === "top" ||
    value.navigationBar === "hidden" ||
    value.navigationBar === "status"
      ? value.navigationBar
      : "status";
  const rawWidgets = isRecord(value.statusBarWidgets) ? value.statusBarWidgets : {};
  const statusBarWidgets = Object.fromEntries(
    Object.entries(DEFAULT_STATUS_BAR_WIDGETS).map(([key, fallback]) => [
      key,
      typeof rawWidgets[key] === "boolean" ? rawWidgets[key] : fallback,
    ]),
  ) as Readonly<Record<StatusBarWidget, boolean>>;
  const keymapOverrides: Readonly<Record<string, string | null>> = isRecord(value.keymapOverrides)
    ? Object.fromEntries(
        Object.entries(value.keymapOverrides).flatMap(
          ([id, accelerator]): readonly [string, string | null][] =>
            id.length <= 256 &&
            (accelerator === null || (typeof accelerator === "string" && accelerator.length <= 128))
              ? [[id, accelerator]]
              : [],
        ),
      )
    : {};
  return {
    compactMode: typeof value.compactMode === "boolean" ? value.compactMode : false,
    ideFontSize:
      typeof value.ideFontSize === "number" &&
      Number.isFinite(value.ideFontSize) &&
      value.ideFontSize >= 8 &&
      value.ideFontSize <= 72
        ? value.ideFontSize
        : 13,
    editorFontSize:
      typeof value.editorFontSize === "number" &&
      Number.isFinite(value.editorFontSize) &&
      value.editorFontSize >= 8 &&
      value.editorFontSize <= 72
        ? value.editorFontSize
        : 13,
    zoom,
    presentationMode: typeof value.presentationMode === "boolean" ? value.presentationMode : false,
    distractionFreeMode:
      typeof value.distractionFreeMode === "boolean" ? value.distractionFreeMode : false,
    zenMode: typeof value.zenMode === "boolean" ? value.zenMode : false,
    presentationAssistant:
      typeof value.presentationAssistant === "boolean" ? value.presentationAssistant : false,
    powerSaveMode: typeof value.powerSaveMode === "boolean" ? value.powerSaveMode : false,
    toolbarVisible: typeof value.toolbarVisible === "boolean" ? value.toolbarVisible : true,
    navigationBar,
    navigationBarShowMembers:
      typeof value.navigationBarShowMembers === "boolean" ? value.navigationBarShowMembers : false,
    toolWindowBarsVisible:
      typeof value.toolWindowBarsVisible === "boolean" ? value.toolWindowBarsVisible : true,
    statusBarVisible: typeof value.statusBarVisible === "boolean" ? value.statusBarVisible : true,
    statusBarWidgets,
    adjustRedGreenVision:
      typeof value.adjustRedGreenVision === "boolean" ? value.adjustRedGreenVision : false,
    showNotifications:
      typeof value.showNotifications === "boolean" ? value.showNotifications : true,
    showShortcutConflictWarning:
      typeof value.showShortcutConflictWarning === "boolean"
        ? value.showShortcutConflictWarning
        : true,
    keymapPreset: isProductKeymapPreset(value.keymapPreset) ? value.keymapPreset : "macOS",
    keymapOverrides,
    bidiTextDirection:
      value.bidiTextDirection === "ltr" || value.bidiTextDirection === "rtl"
        ? value.bidiTextDirection
        : "content",
    scrollToSearchResults:
      typeof value.scrollToSearchResults === "boolean" ? value.scrollToSearchResults : true,
    processWindowAutoShow:
      typeof value.processWindowAutoShow === "boolean" ? value.processWindowAutoShow : false,
    editorColorScheme: isEditorColorScheme(value.editorColorScheme)
      ? value.editorColorScheme
      : "themeDefault",
    language: "English",
    region: isProductRegion(value.region) ? value.region : "asiaExceptChinaMainland",
  };
}
