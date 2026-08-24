import { app, Menu } from "electron";
import type {
  BrowserWindow,
  MenuItem,
  MenuItemConstructorOptions,
} from "electron";
import rawCommandManifest from "../../src/command-manifest.json";
import type {
  NativeCommand,
  NativeCommandState,
} from "../../src/shared/contracts/ipc";

type MenuTemplateItem = MenuItemConstructorOptions;

const COMMANDS_BY_ID = new Map(
  rawCommandManifest.commands.map((command) => [command.id, command]),
);

function manifestCommand(id: string) {
  const command = COMMANDS_BY_ID.get(id);
  if (!command) throw new Error(`Native menu command is not declared: ${id}`);
  return command;
}

const DYNAMIC_LABEL_COMMANDS = new Set([
  "view.presentationMode",
  "view.distractionFreeMode",
  "view.zenMode",
  "view.zoomIde",
  "edit.startMacroRecording",
  "window.activateCurrentProject",
]);

// These actions are advertised in Rebased's empty editor, but are not visible
// entries in the macOS application menu. Electron still needs a native menu
// item to route their accelerators while the renderer has terminal focus.
const ACCELERATOR_ONLY_COMMANDS = new Set([
  "view.openGitLogTab",
  "view.changes",
  "bookmarks.toggle",
  "bookmarks.toggleMnemonic",
]);

export class NativeMenuService {
  readonly #items = new Map<string, MenuItem[]>();
  #projectMenus: MenuItem[] = [];
  #gitMenus: MenuItem[] = [];
  #accelerators = new Map<string, string | null>();
  #acceleratorSignature = "";

  private constructor(
    private readonly window: BrowserWindow,
    private readonly commandSink: (command: NativeCommand) => void,
  ) {}

  static create(
    window: BrowserWindow,
    commandSink: (command: NativeCommand) => void = (): void => undefined,
  ): NativeMenuService {
    const service = new NativeMenuService(window, commandSink);
    service.install();
    return service;
  }

  sync(states: readonly NativeCommandState[]): void {
    const acceleratorSignature = JSON.stringify(
      states.map((state) => [state.id, state.accelerator]),
    );
    if (acceleratorSignature !== this.#acceleratorSignature) {
      this.#acceleratorSignature = acceleratorSignature;
      this.#accelerators = new Map(
        states.map((state) => [state.id, state.accelerator]),
      );
      this.install();
    }
    for (const state of states) {
      const items = this.#items.get(state.id) ?? [];
      for (const item of items) {
        if (state.label !== undefined && DYNAMIC_LABEL_COMMANDS.has(state.id)) {
          item.label = state.label;
        }
        item.enabled = state.enabled;
        if (!ACCELERATOR_ONLY_COMMANDS.has(state.id)) {
          item.visible = state.visible;
        }
        if (
          state.checked !== null &&
          (item.type === "checkbox" || item.type === "radio")
        ) {
          item.checked = state.checked;
        }
      }
    }
    const projectMenusVisible =
      states.find((state) => state.id === "view.project")?.enabled === true;
    for (const item of this.#projectMenus) item.visible = projectMenusVisible;
    const gitMenuVisible =
      projectMenusVisible &&
      states.some(
        (state) =>
          state.enabled &&
          (state.id.startsWith("repository.") ||
            state.id.startsWith("changes.") ||
            state.id.startsWith("history.")),
      );
    for (const item of this.#gitMenus) item.visible = gitMenuVisible;
  }

  dispatch(command: NativeCommand): void {
    this.send(command);
  }

  private command(id: string): MenuTemplateItem {
    const manifest = manifestCommand(id);
    const resolvedAccelerator = this.#accelerators.has(id)
      ? (this.#accelerators.get(id) ?? undefined)
      : (manifest.accelerator ?? undefined);
    return {
      id,
      label: manifest.label,
      accelerator: resolvedAccelerator,
      click: () => this.send({ id }),
    };
  }

  private unavailable(label: string): MenuTemplateItem {
    return { label, enabled: false };
  }

  private acceleratorCommand(id: string): MenuTemplateItem {
    return { ...this.command(id), visible: false };
  }

  private toggleCommand(id: string): MenuTemplateItem {
    return { ...this.command(id), type: "checkbox" };
  }

  private radioCommand(id: string): MenuTemplateItem {
    return { ...this.command(id), type: "radio" };
  }

  private group(label: string, submenu: MenuTemplateItem[]): MenuTemplateItem {
    return { label, submenu };
  }

  private commandGroup(
    id: string,
    label: string,
    submenu: MenuTemplateItem[],
  ): MenuTemplateItem {
    return { id, label, submenu };
  }

  private install(): void {
    this.#items.clear();
    this.#projectMenus = [];
    this.#gitMenus = [];
    const template: MenuTemplateItem[] = [
      {
        label: "Git Client",
        submenu: [
          { role: "about", label: "About Git Client" },
          { type: "separator" },
          this.command("workspace.settings"),
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
          {
            label: "Quit and Keep Windows",
            accelerator: "CmdOrCtrl+Option+Q",
            click: () => app.quit(),
          },
        ],
      },
      {
        label: "File",
        submenu: [
          this.group("New", [
            this.command("workspace.clone"),
            this.command("workspace.new"),
            this.command("workspace.newScratch"),
          ]),
          this.command("workspace.open"),
          this.group("Recent Projects", [
            this.command("workspace.manageProjects"),
          ]),
          { type: "separator" },
          this.command("workspace.close"),
          this.group("File Properties", [
            this.unavailable("Remove BOM"),
            this.unavailable("Add BOM"),
            this.unavailable("Associate with File Type…"),
          ]),
          this.group("Local History", [
            this.command("localHistory.show"),
            this.command("localHistory.showProject"),
            this.command("localHistory.recent"),
            this.command("localHistory.putLabel"),
          ]),
          { type: "separator" },
          this.command("workspace.saveAll"),
          this.command("workspace.reloadAll"),
          this.command("workspace.repairIde"),
          this.command("workspace.invalidateCaches"),
          this.group("Manage IDE Settings", [
            this.command("workspace.importSettings"),
            this.command("workspace.exportSettings"),
            this.command("workspace.restoreDefaultSettings"),
          ]),
          this.group("New Projects Setup", [
            this.command("workspace.settingsNewProjects"),
            this.command("workspace.runConfigurationTemplates"),
          ]),
          this.unavailable("Save File as Template…"),
          this.group("Export", [this.command("workspace.exportHtml")]),
          this.unavailable("Print…"),
          this.toggleCommand("view.powerSaveMode"),
        ],
      },
      {
        label: "Edit",
        submenu: [
          this.command("edit.undo"),
          this.command("edit.redo"),
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          this.command("edit.copyPlainText"),
          { role: "delete" },
          this.command("view.searchInSelection"),
          this.group("Find", [
            this.command("view.search"),
            this.command("edit.replace"),
            this.command("view.findNext"),
            this.command("view.findPrevious"),
            this.command("edit.selectAllOccurrences"),
            this.command("edit.selectNextOccurrence"),
            this.command("edit.unselectOccurrence"),
            this.command("view.searchInSelection"),
            this.toggleCommand("view.scrollSearchResults"),
            this.command("view.findWordAtCaret"),
            this.command("view.findPrevWordAtCaret"),
            this.command("view.findInFiles"),
            this.command("view.replaceInFiles"),
          ]),
          this.group("Find Usages", [
            this.command("edit.findUsages"),
            this.command("edit.findUsagesSettings"),
            this.command("edit.showUsages"),
            this.command("edit.findUsagesFile"),
            this.command("edit.highlightUsages"),
            this.command("edit.nextHighlightedUsage"),
            this.command("edit.previousHighlightedUsage"),
            this.command("edit.recentFindUsages"),
          ]),
          { role: "selectAll" },
          this.command("edit.addCaretsToLineEnds"),
          this.command("edit.extendSelection"),
          this.command("edit.shrinkSelection"),
          this.command("edit.toggleCase"),
          this.command("edit.joinLines"),
          this.command("edit.duplicate"),
          this.command("edit.fillParagraph"),
          this.command("edit.sortLines"),
          this.command("edit.reverseLines"),
          this.command("edit.transpose"),
          this.command("edit.indentSelection"),
          this.command("edit.unindentSelection"),
          this.group("Convert Indents", [
            this.command("edit.convertIndentsToSpaces"),
            this.command("edit.convertIndentsToTabs"),
          ]),
          this.group("Macros", [
            this.command("edit.playbackLastMacro"),
            this.command("edit.startMacroRecording"),
            this.unavailable("Edit Macros"),
            this.command("edit.playSavedMacros"),
          ]),
          this.group("Bookmarks", [
            this.command("bookmarks.previous"),
            this.command("bookmarks.next"),
            this.command("bookmarks.show"),
            this.command("bookmarks.showMnemonics"),
          ]),
          this.acceleratorCommand("bookmarks.toggle"),
          this.acceleratorCommand("bookmarks.toggleMnemonic"),
          {
            label: "Emoji & Symbols",
            click: () => app.showEmojiPanel(),
          },
          this.unavailable("Encode XML/HTML Special Characters"),
        ],
      },
      {
        label: "View",
        submenu: [
          this.group("Tool Windows", [
            this.command("view.project"),
            this.command("view.bookmarks"),
            this.command("view.findToolWindow"),
            this.unavailable("Version Control"),
            this.unavailable("Merge Requests"),
            this.command("view.notifications"),
            this.unavailable("Pull Requests"),
            this.command("view.terminal"),
          ]),
          this.group("Appearance", [
            this.command("view.presentationMode"),
            this.command("view.distractionFreeMode"),
            {
              role: "togglefullscreen",
              label: "Enter Full Screen",
            },
            this.command("view.zenMode"),
            this.toggleCommand("view.compactMode"),
            this.command("view.zoomIde"),
            this.toggleCommand("view.presentationAssistant"),
            this.toggleCommand("view.toolbar"),
            this.group("Navigation Bar", [
              this.radioCommand("view.navigationBarTop"),
              this.radioCommand("view.navigationBarStatus"),
              this.radioCommand("view.navigationBarHidden"),
              this.toggleCommand("view.navigationBarMembers"),
            ]),
            this.toggleCommand("view.toolWindowBars"),
            this.toggleCommand("view.statusBar"),
            this.group("Status Bar Widgets", [
              this.toggleCommand("view.statusWidgetStatusText"),
              this.toggleCommand("view.statusWidgetFileSystemSync"),
              this.toggleCommand("view.statusWidgetAggregator"),
              this.toggleCommand("view.statusWidgetGridPosition"),
              this.toggleCommand("view.statusWidgetLineColumn"),
              this.toggleCommand("view.statusWidgetLanguageServices"),
              this.toggleCommand("view.statusWidgetLineSeparator"),
              this.toggleCommand("view.statusWidgetFileEncoding"),
              this.toggleCommand("view.statusWidgetPowerSaveMode"),
              this.toggleCommand("view.statusWidgetEditorSelectionMode"),
              this.toggleCommand("view.statusWidgetIndentation"),
              this.toggleCommand("view.statusWidgetReadOnlyAttribute"),
              this.toggleCommand("view.statusWidgetMemoryIndicator"),
            ]),
          ]),
          this.command("view.quickDefinition"),
          this.command("view.quickTypeDefinition"),
          this.command("view.recentLocations"),
          this.command("view.recentFiles"),
          this.command("view.recentlyChangedFiles"),
          this.command("localHistory.recent"),
          this.command("view.quickSwitchScheme"),
          this.command("view.resetEditorFontSize"),
          this.group("Bidi Text Base Direction", [
            this.radioCommand("view.bidiContent"),
            this.radioCommand("view.bidiLtr"),
            this.radioCommand("view.bidiRtl"),
          ]),
        ],
      },
      {
        label: "Navigate",
        submenu: [
          this.command("navigate.back"),
          this.command("navigate.forward"),
          this.command("palette.open"),
          this.command("navigate.class"),
          this.command("navigate.file"),
          this.command("navigate.symbol"),
          this.command("navigate.text"),
          this.unavailable("Next Highlighted Error"),
          this.unavailable("Previous Highlighted Error"),
          this.unavailable("Next Emmet Edit Point"),
          this.unavailable("Previous Emmet Edit Point"),
          this.unavailable("Last Edit Location"),
          this.unavailable("Next Edit Location"),
          this.group("Navigate in File", [
            this.command("navigate.nextMethod"),
            this.command("navigate.previousMethod"),
            this.command("navigate.matchingBrace"),
            this.unavailable("Next Live Template Parameter"),
            this.unavailable("Previous Live Template Parameter"),
          ]),
          this.command("navigate.jumpNavigationBar"),
          this.command("navigate.declaration"),
          this.command("navigate.implementation"),
          this.unavailable("Super Method"),
          this.command("navigate.relatedSymbol"),
          this.command("navigate.fileStructure"),
          this.command("navigate.typeHierarchy"),
          this.command("navigate.callHierarchy"),
        ],
      },
      {
        label: "Code",
        submenu: [
          this.group("Code Completion", [
            this.unavailable("Basic"),
            this.unavailable("Type-Matching"),
            this.unavailable("Complete Current Statement"),
            this.unavailable("Cyclic Expand Word"),
            this.unavailable("Cyclic Expand Word (Backward)"),
            this.unavailable("Call Inline Completion"),
            this.unavailable("Insert Inline Proposal"),
            this.unavailable("Insert Inline Proposal's Word"),
            this.unavailable("Insert Inline Proposal's Line"),
            this.unavailable("Enable Command Completion"),
          ]),
          this.command("code.inspect"),
          this.command("code.cleanup"),
          this.group("Analyze Code", [
            this.command("code.silentCleanup"),
            this.command("code.runInspection"),
            this.unavailable("Configure Current File Analysis…"),
            this.command("code.viewOfflineInspection"),
          ]),
          this.command("code.analyzeStackTrace"),
          this.unavailable("Insert Live Template…"),
          this.unavailable("Save as Live Template…"),
          this.unavailable("Surround With…"),
          this.unavailable("Unwrap/Remove…"),
          this.group("Folding", [
            this.command("code.expandFold"),
            this.command("code.expandFoldRecursively"),
            this.command("code.expandAllFolds"),
            this.command("code.collapseFold"),
            this.command("code.collapseFoldRecursively"),
            this.command("code.collapseAllFolds"),
            this.group("Expand to Level", [
              this.unavailable("1"),
              this.unavailable("2"),
              this.unavailable("3"),
              this.unavailable("4"),
              this.unavailable("5"),
            ]),
            this.group("Expand All to Level", [
              this.unavailable("1"),
              this.unavailable("2"),
              this.unavailable("3"),
              this.unavailable("4"),
              this.unavailable("5"),
            ]),
            this.unavailable("Expand Doc Comments"),
            this.unavailable("Collapse Doc Comments"),
            this.command("code.toggleFold"),
            this.command("code.foldSelection"),
            this.command("code.foldBlock"),
          ]),
          this.command("code.lineComment"),
          this.command("code.blockComment"),
          this.command("code.moveStatementDown"),
          this.command("code.moveStatementUp"),
          this.unavailable("Move Element Left"),
          this.unavailable("Move Element Right"),
          this.command("code.moveLineDown"),
          this.command("code.moveLineUp"),
        ],
      },
      {
        label: "Run",
        submenu: [this.unavailable("Run"), this.unavailable("Debug")],
      },
      {
        label: "Tools",
        submenu: [
          this.command("tools.commandLineLauncher"),
          this.group("Services", []),
          this.group("XML Actions", [this.unavailable("Convert Schema...")]),
        ],
      },
      {
        label: "Git",
        submenu: [
          this.command("changes.commit"),
          this.command("repository.push"),
          this.command("repository.update"),
          this.command("repository.pull"),
          this.command("repository.fetch"),
          this.command("repository.merge"),
          this.command("repository.rebase"),
          this.command("repository.branches"),
          this.command("history.newBranch"),
          this.command("repository.newTag"),
          this.command("repository.resetHead"),
          this.command("repository.newWorktree"),
          this.command("repository.worktrees"),
          this.command("view.history"),
          this.group("Patch", [
            this.command("repository.createPatchFromChanges"),
            this.command("repository.applyPatch"),
            this.command("repository.applyPatchFromClipboard"),
          ]),
          this.group("Uncommitted Changes", [
            this.command("repository.shelveChanges"),
            this.command("repository.showShelf"),
            this.command("repository.stashChanges"),
            this.command("repository.showStash"),
            this.command("repository.rollback"),
          ]),
          this.group("Current File", [
            this.command("repository.commitCurrentFile"),
            this.command("repository.addCurrentFile"),
            this.command("repository.showCurrentFileDiff"),
            this.command("repository.compareCurrentFileRevision"),
            this.command("repository.compareCurrentFileRef"),
            this.command("repository.showFileHistory"),
          ]),
          this.group("GitLab", [
            this.command("repository.shareGitLab"),
            this.command("workspace.clone"),
            this.command("repository.manageAccounts"),
          ]),
          this.group("GitHub", [
            this.command("repository.shareGitHub"),
            this.command("workspace.clone"),
            this.command("repository.manageAccounts"),
          ]),
          this.command("repository.manageRemotes"),
          this.command("workspace.clone"),
          this.command("repository.operationsPopup"),
        ],
      },
      {
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          this.group("Layouts", [
            this.command("window.layoutDefault"),
            this.group("Custom", [
              this.command("window.layoutRestoreCustom"),
              this.command("window.layoutSaveCustom"),
              this.command("window.layoutRenameCustom"),
              this.unavailable("Delete…"),
            ]),
            this.command("window.layoutSaveNew"),
          ]),
          this.group("Active Tool Window", [
            this.command("window.hideActiveToolWindow"),
            this.command("window.hideSideToolWindows"),
            this.command("window.hideBottomToolWindows"),
            this.command("window.hideAllToolWindows"),
            this.command("window.jumpLastToolWindow"),
            this.command("window.maximizeToolWindow"),
            this.command("view.nextEditorTab"),
            this.command("view.previousEditorTab"),
            this.command("window.closeActiveToolWindowTab"),
            this.group("View Mode", []),
            this.group("Move to", []),
            this.unavailable("Group Tabs"),
            this.commandGroup("window.resizeToolWindowGroup", "Resize", [
              this.command("window.resizeToolWindowLeft"),
              this.command("window.resizeToolWindowRight"),
              this.command("window.resizeToolWindowUp"),
              this.command("window.resizeToolWindowDown"),
            ]),
          ]),
          this.group("Editor Tabs", [
            this.command("view.nextEditorTab"),
            this.command("view.previousEditorTab"),
            this.command("view.keepEditorTabOpen"),
            this.command("view.closeEditor"),
            this.command("view.closeOtherEditors"),
            this.command("view.closeAllEditors"),
            this.command("view.closeUnmodifiedEditors"),
            this.command("view.closeUnpinnedEditors"),
            this.command("view.closeEditorsToLeft"),
            this.command("view.closeEditorsToRight"),
            this.command("view.closeReadOnlyEditors"),
            this.group("Split with Chooser Navigation", []),
            this.unavailable("Stretch Editor to Top"),
            this.unavailable("Stretch Editor to Left"),
            this.unavailable("Stretch Editor to Bottom"),
            this.unavailable("Stretch Editor to Right"),
            this.unavailable("Change Splitter Orientation"),
            this.unavailable("Maximize Editor/Normalize Splits"),
            this.unavailable("Unsplit"),
            this.unavailable("Unsplit All"),
            this.unavailable("Go to Next Splitter"),
            this.unavailable("Go to Previous Splitter"),
            this.command("workspace.settings"),
          ]),
          this.group("Notifications", [
            this.command("window.closeFirstNotification"),
            this.command("window.closeAllNotifications"),
          ]),
          this.group("Processes", [
            this.toggleCommand("window.showProcesses"),
            this.toggleCommand("window.autoShowProcesses"),
          ]),
          this.unavailable("Next Project Window"),
          this.unavailable("Previous Project Window"),
          this.unavailable("Merge All Project Windows"),
          this.command("window.activateCurrentProject"),
          this.acceleratorCommand("view.openGitLogTab"),
          this.acceleratorCommand("view.changes"),
        ],
      },
      {
        label: "Help",
        submenu: [
          this.command("palette.open"),
          this.command("help.open"),
          this.command("help.whatsNew"),
          this.command("help.keyboardShortcutsPdf"),
          this.unavailable("Submit a Bug Report…"),
          this.command("help.showLog"),
          this.command("help.collectLogs"),
          this.group("Diagnostic Tools", [
            this.command("help.activityMonitor"),
            this.command("help.dumpThreads"),
            this.command("help.debugLogSettings"),
            this.command("help.specialFiles"),
          ]),
          this.command("help.changeMemorySettings"),
          this.command("help.customProperties"),
          this.command("help.customVmOptions"),
          this.command("help.deleteLeftovers"),
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    this.collect(menu.items);
    this.#projectMenus = menu.items.filter(
      (item) =>
        item.label !== "Git Client" &&
        item.label !== "File" &&
        item.label !== "Help",
    );
    this.#gitMenus = menu.items.filter((item) => item.label === "Git");
    for (const item of this.#projectMenus) item.visible = false;
    Menu.setApplicationMenu(menu);
  }

  private collect(items: readonly MenuItem[]): void {
    for (const item of items) {
      if (item.id !== "") {
        const matchingItems = this.#items.get(item.id) ?? [];
        matchingItems.push(item);
        this.#items.set(item.id, matchingItems);
      }
      const submenu = item.submenu;
      if (submenu !== null && submenu !== undefined)
        this.collect(submenu.items);
    }
  }

  private send(command: NativeCommand): void {
    if (this.window.isDestroyed()) return;
    this.commandSink(command);
  }
}
