import { app, Menu } from "electron";
import type { BrowserWindow, MenuItem, MenuItemConstructorOptions } from "electron";
import type { NativeCommand, NativeCommandState } from "../../src/shared/contracts/ipc";
import { IPC_CHANNELS } from "../../src/shared/contracts/ipc";

type MenuTemplateItem = MenuItemConstructorOptions;

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

  private constructor(private readonly window: BrowserWindow) {}

  static create(window: BrowserWindow): NativeMenuService {
    const service = new NativeMenuService(window);
    service.install();
    return service;
  }

  sync(states: readonly NativeCommandState[]): void {
    const acceleratorSignature = JSON.stringify(
      states.map((state) => [state.id, state.accelerator]),
    );
    if (acceleratorSignature !== this.#acceleratorSignature) {
      this.#acceleratorSignature = acceleratorSignature;
      this.#accelerators = new Map(states.map((state) => [state.id, state.accelerator]));
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
        if (state.checked !== null && (item.type === "checkbox" || item.type === "radio")) {
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

  private command(id: string, label: string, accelerator?: string): MenuTemplateItem {
    const resolvedAccelerator = this.#accelerators.has(id)
      ? (this.#accelerators.get(id) ?? undefined)
      : accelerator;
    return {
      id,
      label,
      accelerator: resolvedAccelerator,
      click: () => this.send({ id }),
    };
  }

  private unavailable(label: string): MenuTemplateItem {
    return { label, enabled: false };
  }

  private acceleratorCommand(id: string, label: string): MenuTemplateItem {
    return { ...this.command(id, label), visible: false };
  }

  private toggleCommand(id: string, label: string): MenuTemplateItem {
    return { ...this.command(id, label), type: "checkbox" };
  }

  private radioCommand(id: string, label: string): MenuTemplateItem {
    return { ...this.command(id, label), type: "radio" };
  }

  private group(label: string, submenu: MenuTemplateItem[]): MenuTemplateItem {
    return { label, submenu };
  }

  private commandGroup(id: string, label: string, submenu: MenuTemplateItem[]): MenuTemplateItem {
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
          this.command("workspace.settings", "Settings…", "CmdOrCtrl+,"),
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
            this.command("workspace.clone", "Project from Version Control…"),
            this.command("workspace.new", "New Project"),
            this.command("workspace.newScratch", "Scratch File", "Command+Shift+N"),
          ]),
          this.command("workspace.open", "Open…"),
          this.group("Recent Projects", [
            this.command("workspace.manageProjects", "Manage Projects…"),
          ]),
          { type: "separator" },
          this.command("workspace.close", "Close Project"),
          this.group("File Properties", [
            this.unavailable("Remove BOM"),
            this.unavailable("Add BOM"),
            this.unavailable("Associate with File Type…"),
          ]),
          this.group("Local History", [
            this.command("localHistory.show", "Show History…"),
            this.command("localHistory.showProject", "Show Project History…"),
            this.command("localHistory.recent", "Recent Changes", "Option+Shift+C"),
            this.command("localHistory.putLabel", "Put Label…"),
          ]),
          { type: "separator" },
          this.command("workspace.saveAll", "Save All", "CmdOrCtrl+S"),
          this.command("workspace.reloadAll", "Reload All from Disk"),
          this.command("workspace.repairIde", "Repair IDE"),
          this.command("workspace.invalidateCaches", "Invalidate Caches…"),
          this.group("Manage IDE Settings", [
            this.command("workspace.importSettings", "Import Settings…"),
            this.command("workspace.exportSettings", "Export Settings…"),
            this.command("workspace.restoreDefaultSettings", "Restore Default Settings…"),
          ]),
          this.group("New Projects Setup", [
            this.command("workspace.settingsNewProjects", "Settings for New Projects…"),
            this.command("workspace.runConfigurationTemplates", "Run Configuration Templates…"),
          ]),
          this.unavailable("Save File as Template…"),
          this.group("Export", [
            this.command("workspace.exportHtml", "Files or Selection to HTML…"),
          ]),
          this.unavailable("Print…"),
          this.toggleCommand("view.powerSaveMode", "Power Save Mode"),
        ],
      },
      {
        label: "Edit",
        submenu: [
          this.command("edit.undo", "Undo", "CmdOrCtrl+Z"),
          this.command("edit.redo", "Redo", "CmdOrCtrl+Shift+Z"),
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          this.command("edit.copyPlainText", "Copy as Plain Text"),
          { role: "delete" },
          this.command("view.searchInSelection", "Search In Selection", "Control+Option+E"),
          this.group("Find", [
            this.command("view.search", "Find…", "CmdOrCtrl+F"),
            this.command("edit.replace", "Replace…", "Control+R"),
            this.command("view.findNext", "Find Next Occurrence"),
            this.command("view.findPrevious", "Find Previous Occurrence"),
            this.command(
              "edit.selectAllOccurrences",
              "Select All Occurrences",
              "Control+Command+G",
            ),
            this.command(
              "edit.selectNextOccurrence",
              "Add Selection for Next Occurrence",
              "Control+G",
            ),
            this.command("edit.unselectOccurrence", "Unselect Occurrence", "Control+Shift+G"),
            this.command("view.searchInSelection", "Search In Selection", "Control+Option+E"),
            this.toggleCommand("view.scrollSearchResults", "Scroll to Results During Typing"),
            this.command(
              "view.findWordAtCaret",
              "Next Occurrence of the Word at Caret",
              "Control+F3",
            ),
            this.command(
              "view.findPrevWordAtCaret",
              "Previous Occurrence of the Word at Caret",
              "Control+Shift+F3",
            ),
            this.command("view.findInFiles", "Find in Files…", "Command+Shift+F"),
            this.command("view.replaceInFiles", "Replace in Files…", "Command+Shift+R"),
          ]),
          this.group("Find Usages", [
            this.command("edit.findUsages", "Find Usages", "Option+F7"),
            this.command(
              "edit.findUsagesSettings",
              "Find Usages Settings…",
              "Command+Shift+Option+F7",
            ),
            this.command("edit.showUsages", "Show Usages", "Command+Option+F7"),
            this.command("edit.findUsagesFile", "Find Usages in File", "Command+F7"),
            this.command("edit.highlightUsages", "Highlight Usages in File", "Command+Shift+F7"),
            this.command("edit.nextHighlightedUsage", "Next Highlighted Usage"),
            this.command("edit.previousHighlightedUsage", "Previous Highlighted Usage"),
            this.command("edit.recentFindUsages", "Recent Find Usages"),
          ]),
          { role: "selectAll" },
          this.command(
            "edit.addCaretsToLineEnds",
            "Add Carets to Ends of Selected Lines",
            "Option+Shift+G",
          ),
          this.command("edit.extendSelection", "Extend Selection", "Option+Up"),
          this.command("edit.shrinkSelection", "Shrink Selection", "Option+Down"),
          this.command("edit.toggleCase", "Toggle Case", "Control+Shift+U"),
          this.command("edit.joinLines", "Join Lines", "Control+Shift+J"),
          this.command("edit.duplicate", "Duplicate Line or Selection", "CmdOrCtrl+D"),
          this.command("edit.fillParagraph", "Fill Paragraph"),
          this.command("edit.sortLines", "Sort Lines"),
          this.command("edit.reverseLines", "Reverse Lines"),
          this.command("edit.transpose", "Transpose", "Control+T"),
          this.command("edit.indentSelection", "Indent Selection"),
          this.command("edit.unindentSelection", "Unindent Line or Selection", "Shift+Tab"),
          this.group("Convert Indents", [
            this.command("edit.convertIndentsToSpaces", "To Spaces"),
            this.command("edit.convertIndentsToTabs", "To Tabs"),
          ]),
          this.group("Macros", [
            this.command("edit.playbackLastMacro", "Play Back Last Macro"),
            this.command("edit.startMacroRecording", "Start Macro Recording"),
            this.unavailable("Edit Macros"),
            this.command("edit.playSavedMacros", "Play Saved Macros…"),
          ]),
          this.group("Bookmarks", [
            this.command("bookmarks.previous", "Previous Line Bookmark"),
            this.command("bookmarks.next", "Next Line Bookmark"),
            this.command("bookmarks.show", "Show Line Bookmarks…"),
            this.command("bookmarks.showMnemonics", "Go to Mnemonic…"),
          ]),
          this.acceleratorCommand("bookmarks.toggle", "Toggle Bookmark"),
          this.acceleratorCommand("bookmarks.toggleMnemonic", "Toggle Bookmark Mnemonic…"),
          { label: "Emoji & Symbols", click: () => app.showEmojiPanel() },
          this.unavailable("Encode XML/HTML Special Characters"),
        ],
      },
      {
        label: "View",
        submenu: [
          this.group("Tool Windows", [
            this.command("view.project", "Project", "CmdOrCtrl+1"),
            this.command("view.bookmarks", "Bookmarks", "Command+2"),
            this.command("view.findToolWindow", "Find", "Command+3"),
            this.unavailable("Version Control"),
            this.unavailable("Merge Requests"),
            this.command("view.notifications", "Notifications"),
            this.unavailable("Pull Requests"),
            this.command("view.terminal", "Terminal", "Alt+F12"),
          ]),
          this.group("Appearance", [
            this.command("view.presentationMode", "Enter Presentation Mode"),
            this.command("view.distractionFreeMode", "Enter Distraction Free Mode"),
            { role: "togglefullscreen", label: "Enter Full Screen" },
            this.command("view.zenMode", "Enter Zen Mode"),
            this.toggleCommand("view.compactMode", "Compact Mode"),
            this.command("view.zoomIde", "Zoom IDE (Current: 100%)…"),
            this.toggleCommand("view.presentationAssistant", "Presentation Assistant"),
            this.toggleCommand("view.toolbar", "Toolbar"),
            this.group("Navigation Bar", [
              this.radioCommand("view.navigationBarTop", "Top"),
              this.radioCommand("view.navigationBarStatus", "In Status Bar"),
              this.radioCommand("view.navigationBarHidden", "Don't Show"),
              this.toggleCommand("view.navigationBarMembers", "Show Members"),
            ]),
            this.toggleCommand("view.toolWindowBars", "Tool Window Bars"),
            this.toggleCommand("view.statusBar", "Status Bar"),
            this.group("Status Bar Widgets", [
              this.toggleCommand("view.statusWidgetStatusText", "Status Text"),
              this.toggleCommand("view.statusWidgetFileSystemSync", "File System Sync"),
              this.toggleCommand("view.statusWidgetAggregator", "Aggregator"),
              this.toggleCommand("view.statusWidgetGridPosition", "Grid Position"),
              this.toggleCommand("view.statusWidgetLineColumn", "Line:Column Number"),
              this.toggleCommand("view.statusWidgetLanguageServices", "Language Services"),
              this.toggleCommand("view.statusWidgetLineSeparator", "Line Separator"),
              this.toggleCommand("view.statusWidgetFileEncoding", "File Encoding"),
              this.toggleCommand("view.statusWidgetPowerSaveMode", "Power Save Mode"),
              this.toggleCommand("view.statusWidgetEditorSelectionMode", "Editor Selection Mode"),
              this.toggleCommand("view.statusWidgetIndentation", "Indentation"),
              this.toggleCommand("view.statusWidgetReadOnlyAttribute", "Read-Only Attribute"),
              this.toggleCommand("view.statusWidgetMemoryIndicator", "Memory Indicator"),
            ]),
          ]),
          this.command("view.quickDefinition", "Quick Definition", "Option+Space"),
          this.command("view.quickTypeDefinition", "Quick Type Definition"),
          this.command("view.recentLocations", "Recent Locations"),
          this.command("view.recentFiles", "Recent Files"),
          this.command("view.recentlyChangedFiles", "Recently Changed Files"),
          this.command("localHistory.recent", "Recent Changes", "Option+Shift+C"),
          this.command("view.quickSwitchScheme", "Quick Switch Scheme…", "Control+`"),
          this.command("view.resetEditorFontSize", "Reset Font Size in All Editors"),
          this.group("Bidi Text Base Direction", [
            this.radioCommand("view.bidiContent", "Content-Based"),
            this.radioCommand("view.bidiLtr", "Left-to-Right"),
            this.radioCommand("view.bidiRtl", "Right-to-Left"),
          ]),
        ],
      },
      {
        label: "Navigate",
        submenu: [
          this.command("navigate.back", "Back", "Command+["),
          this.command("navigate.forward", "Forward", "Command+]"),
          this.command("palette.open", "Search Everywhere"),
          this.command("navigate.class", "Class...", "Command+O"),
          this.command("navigate.file", "File…", "CmdOrCtrl+Shift+O"),
          this.command("navigate.symbol", "Symbol…", "Command+Option+O"),
          this.command("navigate.text", "Text…", "Control+Shift+Option+E"),
          this.unavailable("Next Highlighted Error"),
          this.unavailable("Previous Highlighted Error"),
          this.unavailable("Next Emmet Edit Point"),
          this.unavailable("Previous Emmet Edit Point"),
          this.unavailable("Last Edit Location"),
          this.unavailable("Next Edit Location"),
          this.group("Navigate in File", [
            this.command("navigate.nextMethod", "Next Method", "Control+Down"),
            this.command("navigate.previousMethod", "Previous Method", "Control+Up"),
            this.command("navigate.matchingBrace", "Move Caret to Matching Brace", "Control+M"),
            this.unavailable("Next Live Template Parameter"),
            this.unavailable("Previous Live Template Parameter"),
          ]),
          this.command("navigate.jumpNavigationBar", "Jump to Navigation Bar"),
          this.command("navigate.declaration", "Declaration or Usages", "Command+B"),
          this.command("navigate.implementation", "Implementation(s)", "Command+Option+B"),
          this.unavailable("Super Method"),
          this.command("navigate.relatedSymbol", "Related Symbol…"),
          this.command("navigate.fileStructure", "File Structure", "Command+F12"),
          this.command("navigate.typeHierarchy", "Type Hierarchy", "Control+H"),
          this.command("navigate.callHierarchy", "Call Hierarchy", "Control+Option+H"),
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
          this.command("code.inspect", "Inspect Code…"),
          this.command("code.cleanup", "Code Cleanup…"),
          this.group("Analyze Code", [
            this.command("code.silentCleanup", "Silent Code Cleanup"),
            this.command("code.runInspection", "Run Inspection by Name…"),
            this.unavailable("Configure Current File Analysis…"),
            this.command("code.viewOfflineInspection", "View Offline Inspection Results…"),
          ]),
          this.command("code.analyzeStackTrace", "Analyze Stack Trace or Thread Dump…"),
          this.unavailable("Insert Live Template…"),
          this.unavailable("Save as Live Template…"),
          this.unavailable("Surround With…"),
          this.unavailable("Unwrap/Remove…"),
          this.group("Folding", [
            this.command("code.expandFold", "Expand"),
            this.command("code.expandFoldRecursively", "Expand Recursively"),
            this.command("code.expandAllFolds", "Expand All"),
            this.command("code.collapseFold", "Collapse"),
            this.command("code.collapseFoldRecursively", "Collapse Recursively"),
            this.command("code.collapseAllFolds", "Collapse All"),
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
            this.command("code.toggleFold", "Toggle Folding"),
            this.command("code.foldSelection", "Fold Selection / Remove Region"),
            this.command("code.foldBlock", "Fold Code Block"),
          ]),
          this.command("code.lineComment", "Comment with Line Comment", "CmdOrCtrl+/"),
          this.command("code.blockComment", "Comment with Block Comment", "CmdOrCtrl+Shift+/"),
          this.command("code.moveStatementDown", "Move Statement Down", "CmdOrCtrl+Shift+Down"),
          this.command("code.moveStatementUp", "Move Statement Up", "CmdOrCtrl+Shift+Up"),
          this.unavailable("Move Element Left"),
          this.unavailable("Move Element Right"),
          this.command("code.moveLineDown", "Move Line Down", "Option+Shift+Down"),
          this.command("code.moveLineUp", "Move Line Up", "Option+Shift+Up"),
        ],
      },
      {
        label: "Run",
        submenu: [this.unavailable("Run"), this.unavailable("Debug")],
      },
      {
        label: "Tools",
        submenu: [
          this.command("tools.commandLineLauncher", "Create Command Line Launcher…"),
          this.group("Services", []),
          this.group("XML Actions", [this.unavailable("Convert Schema...")]),
        ],
      },
      {
        label: "Git",
        submenu: [
          this.command("changes.commit", "Commit…", "CmdOrCtrl+Enter"),
          this.command("repository.push", "Push…", "CmdOrCtrl+Shift+P"),
          this.command("repository.update", "Update Project..."),
          this.command("repository.pull", "Pull…", "CmdOrCtrl+Shift+L"),
          this.command("repository.fetch", "Fetch"),
          this.command("repository.merge", "Merge…"),
          this.command("repository.rebase", "Rebase…"),
          this.command("repository.branches", "Branches…"),
          this.command("history.newBranch", "New Branch…", "CmdOrCtrl+Option+N"),
          this.command("repository.newTag", "New Tag…"),
          this.command("repository.resetHead", "Reset HEAD…"),
          this.command("repository.newWorktree", "New Worktree…"),
          this.command("repository.worktrees", "Worktrees…"),
          this.command("view.history", "Show Git Log"),
          this.group("Patch", [
            this.command("repository.createPatchFromChanges", "Create Patch from Local Changes…"),
            this.command("repository.applyPatch", "Apply Patch…"),
            this.command("repository.applyPatchFromClipboard", "Apply Patch from Clipboard…"),
          ]),
          this.group("Uncommitted Changes", [
            this.command("repository.shelveChanges", "Shelve Changes…"),
            this.command("repository.showShelf", "Show Shelf"),
            this.command("repository.stashChanges", "Stash Changes…"),
            this.command("repository.showStash", "Unstash Changes…"),
            this.command("repository.rollback", "Rollback…"),
          ]),
          this.group("Current File", [
            this.command("repository.commitCurrentFile", "Commit…"),
            this.command("repository.addCurrentFile", "Add"),
            this.command("repository.showCurrentFileDiff", "Show Diff"),
            this.command("repository.compareCurrentFileRevision", "Compare with Revision…"),
            this.command("repository.compareCurrentFileRef", "Compare with Branch or Tag…"),
            this.command("repository.showFileHistory", "Show History"),
          ]),
          this.group("GitLab", [
            this.command("repository.shareGitLab", "Share Project on GitLab"),
            this.command("workspace.clone", "Clone Repository…"),
            this.command("repository.manageAccounts", "Manage Accounts…"),
          ]),
          this.group("GitHub", [
            this.command("repository.shareGitHub", "Share Project on GitHub"),
            this.command("workspace.clone", "Clone Repository…"),
            this.command("repository.manageAccounts", "Manage Accounts…"),
          ]),
          this.command("repository.manageRemotes", "Manage Remotes…"),
          this.command("workspace.clone", "Clone…"),
          this.command("repository.operationsPopup", "VCS Operations Popup…", "Control+V"),
        ],
      },
      {
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          this.group("Layouts", [
            this.command("window.layoutDefault", "Default"),
            this.group("Custom", [
              this.command("window.layoutRestoreCustom", "Restore"),
              this.command("window.layoutSaveCustom", "Save Changes"),
              this.command("window.layoutRenameCustom", "Rename"),
              this.unavailable("Delete…"),
            ]),
            this.command("window.layoutSaveNew", "Save Current Layout as New…"),
          ]),
          this.group("Active Tool Window", [
            this.command("window.hideActiveToolWindow", "Hide Active Tool Window", "Shift+Escape"),
            this.command("window.hideSideToolWindows", "Hide Side Tool Windows"),
            this.command("window.hideBottomToolWindows", "Hide Bottom Tool Windows"),
            this.command("window.hideAllToolWindows", "Hide All Tool Windows", "Control+Shift+F12"),
            this.command("window.jumpLastToolWindow", "Jump to Last Tool Window", "F12"),
            this.command("window.maximizeToolWindow", "Maximize Tool Window", "Control+Shift+'"),
            this.command("view.nextEditorTab", "Select Next Tab"),
            this.command("view.previousEditorTab", "Select Previous Tab"),
            this.command("window.closeActiveToolWindowTab", "Close Active Tab", "Control+Shift+F4"),
            this.group("View Mode", []),
            this.group("Move to", []),
            this.unavailable("Group Tabs"),
            this.commandGroup("window.resizeToolWindowGroup", "Resize", [
              this.command("window.resizeToolWindowLeft", "Stretch to Left", "Control+Option+Left"),
              this.command(
                "window.resizeToolWindowRight",
                "Stretch to Right",
                "Control+Option+Right",
              ),
              this.command("window.resizeToolWindowUp", "Stretch to Top", "Control+Option+Up"),
              this.command(
                "window.resizeToolWindowDown",
                "Stretch to Bottom",
                "Control+Option+Down",
              ),
            ]),
          ]),
          this.group("Editor Tabs", [
            this.command("view.nextEditorTab", "Select Next Tab"),
            this.command("view.previousEditorTab", "Select Previous Tab"),
            this.command("view.keepEditorTabOpen", "Keep Tab Open"),
            this.command("view.closeEditor", "Close Tab", "CmdOrCtrl+W"),
            this.command("view.closeOtherEditors", "Close Other Tabs"),
            this.command("view.closeAllEditors", "Close All Tabs"),
            this.command("view.closeUnmodifiedEditors", "Close Unmodified Tabs"),
            this.command("view.closeUnpinnedEditors", "Close All but Pinned"),
            this.command("view.closeEditorsToLeft", "Close Tabs to the Left"),
            this.command("view.closeEditorsToRight", "Close Tabs to the Right"),
            this.command("view.closeReadOnlyEditors", "Close All Read-Only"),
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
            this.command("workspace.settings", "Configure Editor Tabs…"),
          ]),
          this.group("Notifications", [
            this.command("window.closeFirstNotification", "Close First"),
            this.command("window.closeAllNotifications", "Close All"),
          ]),
          this.group("Processes", [
            this.toggleCommand("window.showProcesses", "Show"),
            this.toggleCommand("window.autoShowProcesses", "Auto Show"),
          ]),
          this.unavailable("Next Project Window"),
          this.unavailable("Previous Project Window"),
          this.unavailable("Merge All Project Windows"),
          this.command("window.activateCurrentProject", "Git Client"),
          this.acceleratorCommand("view.openGitLogTab", "Open Git Log"),
          this.acceleratorCommand("view.changes", "Commit"),
        ],
      },
      {
        label: "Help",
        submenu: [
          this.command("palette.open", "Find Action…"),
          this.command("help.open", "Help"),
          this.command("help.whatsNew", "What's New in Git Client"),
          this.command("help.keyboardShortcutsPdf", "Keyboard Shortcuts PDF"),
          this.unavailable("Submit a Bug Report…"),
          this.command("help.showLog", "Show Log in Finder"),
          this.command("help.collectLogs", "Collect Logs and Diagnostic Data"),
          this.group("Diagnostic Tools", [
            this.command("help.activityMonitor", "Activity Monitor…"),
            this.command("help.dumpThreads", "Dump Threads"),
            this.command("help.debugLogSettings", "Debug Log Settings…"),
            this.command("help.specialFiles", "Special Files and Folders…"),
          ]),
          this.command("help.changeMemorySettings", "Change Memory Settings"),
          this.command("help.customProperties", "Edit Custom Properties…"),
          this.command("help.customVmOptions", "Edit Custom VM Options…"),
          this.command("help.deleteLeftovers", "Delete Leftover IDE Directories…"),
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    this.collect(menu.items);
    this.#projectMenus = menu.items.filter(
      (item) => item.label !== "Git Client" && item.label !== "File" && item.label !== "Help",
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
      if (submenu !== null && submenu !== undefined) this.collect(submenu.items);
    }
  }

  private send(command: NativeCommand): void {
    if (this.window.isDestroyed()) return;
    this.window.webContents.send(IPC_CHANNELS.menuCommand, command);
  }
}
