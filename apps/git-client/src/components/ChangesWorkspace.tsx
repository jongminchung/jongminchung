import { Button } from "@jongminchung/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  ChangeEntry,
  ChangeSelection,
  CommitDraft,
  DiffPreferences,
} from "../domain/changeReview";
import { normalizePartialPatchTarget } from "../domain/changeReview";
import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../domain/commands";
import type { FileChange, StatusModel } from "../domain/types";
import type {
  Changelist,
  FileContent,
  FilePreview,
  GitOperation,
  PreCommitCheck,
  SubmoduleDiff,
} from "../shared/contracts/model/index";
import { useAppDialog } from "./AppDialog";
import { ChangeNavigator } from "./changes/ChangeNavigator";
import { CommitComposer } from "./changes/CommitComposer";
import { useChangeSelection } from "./changes/useChangeSelection";
import { useCommitFlow } from "./changes/useCommitFlow";
import { useCommandDefinitions, useDismissLayer } from "./CommandProvider";
import { DiffViewer } from "./DiffViewer";
import { Icon } from "./Icon";
import { CheckboxInput } from "./ProductFormControls";
import { Popover } from "./ProductOverlays";

interface ChangesWorkspaceProps {
  readonly toolWindow?: boolean;
  readonly status: StatusModel;
  readonly entries: readonly ChangeEntry[];
  readonly selection: ChangeSelection | null;
  readonly patch: string;
  readonly diffLoading: boolean;
  readonly beforePreview: FilePreview | null;
  readonly afterPreview: FilePreview | null;
  readonly beforeContent: FileContent | null;
  readonly afterContent: FileContent | null;
  readonly submoduleDiff: SubmoduleDiff | null;
  readonly navigatorWidth: number;
  readonly commitRailWidth: number;
  readonly preferences: DiffPreferences;
  readonly draft: CommitDraft;
  readonly changelists: readonly Changelist[];
  readonly onSelectionChange: (selection: ChangeSelection) => void;
  readonly onPreferencesChange: (preferences: DiffPreferences) => void;
  readonly onDraftChange: (draft: CommitDraft) => void;
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onCommitOperation: (operation: GitOperation) => Promise<void>;
  readonly onPreCommitCheck: () => Promise<PreCommitCheck>;
  readonly onCommitChangelist: (
    changelistId: string,
    message: string,
    amend: boolean,
    signOff: boolean,
    gpgSign: boolean,
  ) => Promise<void>;
  readonly onSaveChangelist: (
    id: string | null,
    name: string,
    paths: readonly string[],
  ) => Promise<Changelist>;
  readonly onDeleteChangelist: (changelistId: string) => Promise<void>;
  readonly onInspectFile: (
    file: FileChange,
    layer: ChangeSelection["layer"],
    view: "file" | "history" | "blame",
  ) => void;
  readonly onOpenExternally: (file: FileChange) => Promise<void>;
  readonly onOpenConflict: (file: FileChange) => void;
  readonly onNavigatorWidthChange: (width: number) => void;
  readonly onCommitRailWidthChange: (width: number) => void;
  readonly onOpenPush: () => void;
  readonly onCloseToolWindow?: () => void;
}

export function ChangesWorkspace({
  toolWindow = false,
  status,
  entries,
  selection,
  patch,
  diffLoading,
  beforePreview,
  afterPreview,
  beforeContent,
  afterContent,
  submoduleDiff,
  navigatorWidth,
  commitRailWidth,
  preferences,
  draft,
  changelists,
  onSelectionChange,
  onPreferencesChange,
  onDraftChange,
  onOperation,
  onCommitOperation,
  onPreCommitCheck,
  onCommitChangelist,
  onSaveChangelist,
  onDeleteChangelist,
  onInspectFile,
  onOpenExternally,
  onOpenConflict,
  onNavigatorWidthChange,
  onCommitRailWidthChange,
  onOpenPush,
  onCloseToolWindow,
}: ChangesWorkspaceProps) {
  const [treeMode, setTreeMode] = useState(true);
  const [diffPreviewVisible, setDiffPreviewVisible] = useState(true);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const navigator = useRef<HTMLElement>(null);
  const dialog = useAppDialog();
  const {
    collapseSelection,
    discardSelectedChanges,
    effectiveSelectedEntries,
    filteredEntries,
    handleNavigatorKeyboard,
    moveSelection,
    query,
    runFileAction,
    selectedEntry,
    selectedIndex,
    selectedKeys,
    selectEntry,
    setQuery,
  } = useChangeSelection({
    dialog,
    diffPreviewVisible,
    entries,
    navigator,
    onFocusDiff: () => setFocused(true),
    onOpenConflict: (entry) => onOpenConflict(entry.file),
    onOperation,
    onSelectionChange,
    searchInput,
    selection,
  });
  const staged = filteredEntries.filter(
    (entry) => entry.selection.layer === "index",
  );
  const worktree = filteredEntries.filter(
    (entry) => entry.selection.layer === "worktree",
  );
  const {
    assign,
    canCommit,
    changelistMutation,
    closeCommitComposer,
    commit,
    commitDisabled,
    commitOptionCount,
    commitRailOpen,
    committing,
    createChangelist,
    deleteSelectedChangelist,
    focusCommitMessage,
    openCommitComposer,
    selectedChangelist,
    stagedFiles,
  } = useCommitFlow({
    changelists,
    dialog,
    draft,
    navigator,
    onCommitChangelist,
    onCommitOperation,
    onDeleteChangelist,
    onDraftChange,
    onOpenPush,
    onPreCommitCheck,
    onSaveChangelist,
    status,
    toolWindow,
    workspace,
  });

  const changeCommands: readonly CommandDefinition[] = [
    commandDefinition("changes.save", runFileAction, () =>
      selectedEntry
        ? COMMAND_ENABLED
        : commandDisabled("Select a changed file to stage or unstage."),
    ),
    commandDefinition(
      "changes.commit",
      () => commit(false),
      () =>
        committing
          ? commandDisabled("A commit is already in progress.")
          : canCommit
            ? COMMAND_ENABLED
            : commandDisabled(
                "Enter a commit message and stage at least one file.",
              ),
    ),
    commandDefinition(
      "changes.commitPush",
      () => commit(true),
      () =>
        committing
          ? commandDisabled("A commit is already in progress.")
          : canCommit
            ? COMMAND_ENABLED
            : commandDisabled(
                "Enter a commit message and stage at least one file.",
              ),
    ),
  ];
  useCommandDefinitions(changeCommands);

  useDismissLayer(
    useMemo(
      () => ({
        id: "focused-diff",
        priority: 70,
        active: focused,
        dismiss: () => setFocused(false),
      }),
      [focused],
    ),
  );
  useDismissLayer(
    useMemo(
      () => ({
        id: "commit-drawer",
        priority: 60,
        active: commitRailOpen,
        dismiss: closeCommitComposer,
      }),
      [closeCommitComposer, commitRailOpen],
    ),
  );
  useDismissLayer(
    useMemo(
      () => ({
        id: "change-multi-selection",
        priority: 20,
        active: selectedKeys.size > 1,
        dismiss: collapseSelection,
      }),
      [collapseSelection, selectedKeys.size],
    ),
  );
  const viewOptions = (
    <Popover
      alignment="end"
      hasAutoFocus
      isOpen={viewOptionsOpen}
      label="View Options"
      onOpenChange={setViewOptionsOpen}
      placement="below"
      width={250}
      content={
        <div className="changesViewOptions">
          <strong>Group By</strong>
          <CheckboxInput
            label="Directory"
            onChange={setTreeMode}
            size="sm"
            value={treeMode}
          />
          <CheckboxInput
            isDisabled
            label="Repository"
            size="sm"
            value={false}
          />
          <strong>View</strong>
          <CheckboxInput
            label="Preview Diff"
            onChange={setDiffPreviewVisible}
            size="sm"
            value={diffPreviewVisible}
          />
          <CheckboxInput
            isDisabled
            label="Ignored Files"
            size="sm"
            value={false}
          />
        </div>
      }
    >
      <Button
        type="button"
        aria-label={"View Options"}
        className={cn("h-[26px] min-w-[26px] px-2 aspect-square px-0")}
        variant="ghost"
        size="icon-sm"
      >
        <Icon name="more" size={14} />
      </Button>
    </Popover>
  );

  return (
    <div
      className={cn(
        "changesWorkspace",
        toolWindow && "changesToolWindow",
        focused && !toolWindow && "changesWorkspaceFocused",
        commitRailOpen && "commitRailOpen",
      )}
      ref={workspace}
      style={
        {
          "--changes-navigator-width": `${navigatorWidth}px`,
          "--commit-rail-width": `${commitRailWidth}px`,
        } as CSSProperties
      }
    >
      {toolWindow && (
        <header className="commitToolWindowHeader">
          <strong>Commit</strong>
          <span />
          {viewOptions}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Close Commit"
                  onClick={onCloseToolWindow}
                  type="button"
                  className="text-muted-foreground"
                  variant="ghost"
                  size="icon-sm"
                >
                  <Icon name="close" size={13} />
                </Button>
              }
            />
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </header>
      )}
      <ChangeNavigator
        assign={assign}
        discardSelectedChanges={discardSelectedChanges}
        effectiveSelectedEntries={effectiveSelectedEntries}
        entries={entries}
        filteredEntries={filteredEntries}
        navigator={navigator}
        navigatorWidth={navigatorWidth}
        onFocusDiff={() => setFocused(true)}
        onInspectFile={onInspectFile}
        onKeyDown={handleNavigatorKeyboard}
        onNavigatorWidthChange={onNavigatorWidthChange}
        onOpenCommitComposer={openCommitComposer}
        onOperation={onOperation}
        onQueryChange={setQuery}
        onSelectEntry={selectEntry}
        onTreeModeChange={setTreeMode}
        query={query}
        searchInput={searchInput}
        selectedEntry={selectedEntry}
        selectedKeys={selectedKeys}
        selection={selection}
        staged={staged}
        toolWindow={toolWindow}
        treeMode={treeMode}
        viewOptions={viewOptions}
        worktree={worktree}
      />
      {diffPreviewVisible ? (
        <DiffViewer
          afterContent={afterContent}
          afterPreview={afterPreview}
          beforeContent={beforeContent}
          beforePreview={beforePreview}
          submoduleDiff={submoduleDiff}
          file={selectedEntry?.file ?? null}
          focused={focused}
          loading={diffLoading}
          mode={selection?.layer === "index" ? "unstage" : "stage"}
          onApplyPatch={async (partialPatch, cached, reverse) => {
            if (selection === null) return;
            const target = normalizePartialPatchTarget(selection, {
              cached,
              reverse,
            });
            if (target === null) return;
            await onOperation({
              kind: "partialPatch",
              patch: partialPatch,
              cached: target.cached,
              reverse: target.reverse,
            });
          }}
          onFileAction={selectedEntry ? runFileAction : undefined}
          onNextFile={
            selectedIndex >= 0 && selectedIndex < filteredEntries.length - 1
              ? () => moveSelection(1)
              : undefined
          }
          onOpenExternally={
            selectedEntry
              ? () => onOpenExternally(selectedEntry.file)
              : undefined
          }
          onPreferencesChange={onPreferencesChange}
          onPreviousFile={
            selectedIndex > 0 ? () => moveSelection(-1) : undefined
          }
          onToggleFocus={() => setFocused((current) => !current)}
          patch={patch}
          preferences={preferences}
          sourceLabel={
            selection?.layer === "index" ? "HEAD → Index" : "Index → Worktree"
          }
        />
      ) : (
        <section className="diffPreviewHidden" aria-label="Diff preview hidden">
          <Icon name="changes" size={28} />
          <p>Diff preview is hidden.</p>
          <Button
            onClick={() => setDiffPreviewVisible(true)}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="ghost"
            size="sm"
          >
            Show Diff Preview
          </Button>
        </section>
      )}
      <CommitComposer
        changelistMutation={changelistMutation}
        changelists={changelists}
        closeCommitComposer={closeCommitComposer}
        commit={commit}
        commitDisabled={commitDisabled}
        commitOptionCount={commitOptionCount}
        commitRailWidth={commitRailWidth}
        committing={committing}
        createChangelist={createChangelist}
        deleteSelectedChangelist={deleteSelectedChangelist}
        draft={draft}
        focusCommitMessage={focusCommitMessage}
        onCommitRailWidthChange={onCommitRailWidthChange}
        onDraftChange={onDraftChange}
        selectedChangelist={selectedChangelist}
        stagedFiles={stagedFiles}
        toolWindow={toolWindow}
      />
      {dialog.node}
    </div>
  );
}
