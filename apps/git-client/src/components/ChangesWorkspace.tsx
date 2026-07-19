import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Popover } from "@astryxdesign/core/Popover";
import { Selector } from "@astryxdesign/core/Selector";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type {
  ChangeEntry,
  ChangeSelection,
  CommitDraft,
  DiffPreferences,
} from "../domain/changeReview";
import { hasSameChangeSelection } from "../domain/changeReview";
import type { FileChange, StatusModel } from "../domain/types";
import type { Changelist, FileContent, FilePreview, GitOperation, PreCommitCheck, SubmoduleDiff } from "../generated";
import { useAppDialog } from "./AppDialog";
import { useCommandDefinitions, useDismissLayer } from "./CommandProvider";
import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../domain/commands";
import { DiffViewer } from "./DiffViewer";
import { Icon } from "./Icon";
import { VerticalResizeHandle } from "./VerticalResizeHandle";
import { tw } from "../styles/tailwind";

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
  readonly onInspectFile: (file: FileChange, layer: ChangeSelection["layer"], view: "file" | "history" | "blame") => void;
  readonly onOpenExternally: (file: FileChange) => Promise<void>;
  readonly onOpenConflict: (file: FileChange) => void;
  readonly onNavigatorWidthChange: (width: number) => void;
  readonly onCommitRailWidthChange: (width: number) => void;
  readonly onOpenPush: () => void;
  readonly onCloseToolWindow?: () => void;
}

function selectionKey(selection: ChangeSelection): string {
  return `${selection.layer}:${selection.path}`;
}

function statusLetter(file: FileChange): string {
  if (file.status === "untracked") return "?";
  if (file.status === "conflicted") return "!";
  return file.status.charAt(0).toUpperCase();
}

function statusClass(file: FileChange): string {
  if (file.status === "added") return tw.statusAdded;
  if (file.status === "deleted") return tw.statusDeleted;
  if (file.status === "renamed" || file.status === "copied") return tw.statusRenamed;
  if (file.status === "conflicted") return tw.statusConflict;
  if (file.status === "untracked") return tw.statusUnknown;
  return tw.statusModified;
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
  const [query, setQuery] = useState("");
  const [treeMode, setTreeMode] = useState(true);
  const [diffPreviewVisible, setDiffPreviewVisible] = useState(true);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [commitRailOpen, setCommitRailOpen] = useState(false);
  const [commitOptionsOpen, setCommitOptionsOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const navigator = useRef<HTMLElement>(null);
  const dialog = useAppDialog();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredEntries = useMemo(
    () => entries.filter((entry) => !normalizedQuery || entry.file.path.toLocaleLowerCase().includes(normalizedQuery)),
    [entries, normalizedQuery],
  );
  const staged = filteredEntries.filter((entry) => entry.selection.layer === "index");
  const worktree = filteredEntries.filter((entry) => entry.selection.layer === "worktree");
  const selectedEntry = entries.find((entry) => selection && hasSameChangeSelection(entry.selection, selection)) ?? null;
  const selectedEntries = entries.filter((entry) => selectedKeys.has(selectionKey(entry.selection)));
  const effectiveSelectedEntries = selectedEntries.length > 0
    ? selectedEntries
    : selectedEntry
      ? [selectedEntry]
      : [];
  const selectedIndex = selectedEntry ? filteredEntries.indexOf(selectedEntry) : -1;
  const selectedChangelist = draft.changelistId === null
    ? null
    : changelists.find((item) => item.id === draft.changelistId) ?? null;
  const stagedFiles = status.changes.filter((file) => file.staged);
  const hasCommitAllChanges =
    draft.commitAll && status.changes.some((file) => file.worktree && file.status !== "untracked");
  const commitOptionCount = [
    draft.amend,
    draft.signOff,
    draft.gpgSign,
    !draft.runHooks,
    draft.commitAll,
  ].filter(Boolean).length;
  const commitDisabled =
    committing ||
    !draft.message.trim() ||
    (selectedChangelist
      ? selectedChangelist.paths.length === 0
      : stagedFiles.length === 0 && !hasCommitAllChanges);

  const moveSelection = (offset: number): void => {
    if (filteredEntries.length === 0) return;
    const nextIndex = Math.min(
      filteredEntries.length - 1,
      Math.max(0, (selectedIndex < 0 ? 0 : selectedIndex) + offset),
    );
    const next = filteredEntries[nextIndex];
    if (next) {
      const key = selectionKey(next.selection);
      onSelectionChange(next.selection);
      setSelectedKeys(new Set([key]));
      setSelectionAnchor(key);
    }
  };

  useEffect(() => {
    const find = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const ownsSearch = searchInput.current === document.activeElement || navigator.current?.contains(document.activeElement);
      if (!ownsSearch || !query) return;
      const direction = event.detail?.direction === -1 ? -1 : 1;
      if (filteredEntries.length === 0) return;
      const nextIndex = (Math.max(0, selectedIndex) + direction + filteredEntries.length) % filteredEntries.length;
      const next = filteredEntries[nextIndex];
      if (next) onSelectionChange(next.selection);
    };
    window.addEventListener("git-client:find", find);
    return () => window.removeEventListener("git-client:find", find);
  }, [filteredEntries, onSelectionChange, query, selectedIndex]);

  const selectEntry = (event: ReactMouseEvent, entry: ChangeEntry): void => {
    if (diffPreviewVisible) onSelectionChange(entry.selection);
    const key = selectionKey(entry.selection);
    if (event.shiftKey) {
      const anchor = selectionAnchor ?? (selection ? selectionKey(selection) : key);
      const anchorIndex = filteredEntries.findIndex((candidate) => selectionKey(candidate.selection) === anchor);
      const targetIndex = filteredEntries.findIndex((candidate) => selectionKey(candidate.selection) === key);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] = anchorIndex <= targetIndex
          ? [anchorIndex, targetIndex]
          : [targetIndex, anchorIndex];
        setSelectedKeys(new Set(filteredEntries.slice(start, end + 1).map((candidate) => selectionKey(candidate.selection))));
        setSelectionAnchor(anchor);
        return;
      }
    }
    if (!event.metaKey && !event.ctrlKey) {
      setSelectedKeys(new Set([key]));
      setSelectionAnchor(key);
      return;
    }
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.size === 0 && selection) next.add(selectionKey(selection));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSelectionAnchor(key);
  };

  const handleNavigatorKeyboard = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.key === "Enter" && selectedEntry) {
      event.preventDefault();
      setFocused(true);
      return;
    }
    if (event.key === " " && selectedEntry) {
      event.preventDefault();
      void runFileAction();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "a") {
      event.preventDefault();
      setSelectedKeys(new Set(filteredEntries.map((entry) => selectionKey(entry.selection))));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? filteredEntries[0] : filteredEntries.at(-1);
      if (next) {
        const key = selectionKey(next.selection);
        onSelectionChange(next.selection);
        setSelectedKeys(new Set([key]));
        setSelectionAnchor(key);
      }
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    moveSelection(event.key === "ArrowUp" ? -1 : 1);
  };

  const runFileAction = async (): Promise<void> => {
    if (!selectedEntry) return;
    if (selectedEntry.file.status === "conflicted") {
      onOpenConflict(selectedEntry.file);
      return;
    }
    await onOperation({
      kind: selectedEntry.selection.layer === "index" ? "unstage" : "stage",
      paths: [selectedEntry.file.path],
    });
  };

  useEffect(() => {
    if (!selection) {
      setSelectedKeys(new Set());
      setSelectionAnchor(null);
      return;
    }
    const key = selectionKey(selection);
    setSelectedKeys((current) => current.size > 1 ? current : new Set([key]));
    setSelectionAnchor((current) => current ?? key);
  }, [selection?.layer, selection?.path]);

  const assign = async (file: FileChange): Promise<void> => {
    const choice = await dialog.input({
      title: "Assign to changelist",
      label: "Changelist name",
      initialValue: changelists[0]?.name ?? "Feature work",
      description: `Moves ${file.path} out of its current changelist.`,
    });
    const name = choice?.trim();
    if (!name) return;
    const existing = changelists.find((changelist) => changelist.name === name) ?? null;
    for (const changelist of changelists) {
      if (changelist.id !== existing?.id && changelist.paths.includes(file.path)) {
        await onSaveChangelist(
          changelist.id,
          changelist.name,
          changelist.paths.filter((path) => path !== file.path),
        );
      }
    }
    const saved = await onSaveChangelist(
      existing?.id ?? null,
      name,
      [...(existing?.paths ?? []), file.path],
    );
    onDraftChange({ ...draft, changelistId: saved.id });
  };

  const commit = async (push: boolean): Promise<void> => {
    const message = draft.message.trim();
    if (!message) return;
    setCommitting(true);
    try {
      const check = await onPreCommitCheck();
      const warnings = [
        check.detachedHead ? "HEAD is detached; the commit will not belong to a branch." : "",
        check.protectedBranch ? `Branch ${check.branch ?? ""} is commonly protected.` : "",
        check.crlfPaths.length > 0 ? `CRLF: ${check.crlfPaths.join(", ")}` : "",
        check.largeFiles.length > 0 ? `Over 10 MiB: ${check.largeFiles.join(", ")}` : "",
        check.riskyPaths.length > 0 ? `Risky paths: ${check.riskyPaths.join(", ")}` : "",
      ].filter(Boolean);
      if (warnings.length > 0) {
        const accepted = await dialog.confirm({
          title: "Pre-commit checks found warnings",
          description: "Review the affected branch and staged paths before creating the commit.",
          impact: warnings.join("\n"),
          confirmLabel: push ? "Commit and push" : "Commit anyway",
          dangerous: true,
        });
        if (!accepted) return;
      }
      if (selectedChangelist) {
        await onCommitChangelist(
          selectedChangelist.id,
          message,
          draft.amend,
          draft.signOff,
          draft.gpgSign,
        );
      } else {
        await onCommitOperation({
          kind: "commitAdvanced",
          message,
          amend: draft.amend,
          signOff: draft.signOff,
          gpgSign: draft.gpgSign,
          skipHooks: !draft.runHooks,
          commitAll: draft.commitAll,
        });
      }
      if (push) {
        onOpenPush();
      }
      onDraftChange({ ...draft, message: "", changelistId: null });
    } finally {
      setCommitting(false);
    }
  };

  const canCommit = Boolean(
    draft.message.trim() &&
    (selectedChangelist
      ? selectedChangelist.paths.length > 0
      : stagedFiles.length > 0 || hasCommitAllChanges),
  );
  const changeCommands = useMemo<readonly CommandDefinition[]>(() => [
    commandDefinition(
      "changes.save",
      runFileAction,
      () => selectedEntry
        ? COMMAND_ENABLED
        : commandDisabled("Select a changed file to stage or unstage."),
    ),
    commandDefinition(
      "changes.commit",
      () => commit(false),
      () => committing
        ? commandDisabled("A commit is already in progress.")
        : canCommit
          ? COMMAND_ENABLED
          : commandDisabled("Enter a commit message and stage at least one file."),
    ),
    commandDefinition(
      "changes.commitPush",
      () => commit(true),
      () => committing
        ? commandDisabled("A commit is already in progress.")
        : canCommit
          ? COMMAND_ENABLED
          : commandDisabled("Enter a commit message and stage at least one file."),
    ),
  ], [canCommit, commit, committing, runFileAction, selectedEntry]);
  useCommandDefinitions(changeCommands);

  useDismissLayer(useMemo(() => ({
    id: "focused-diff",
    priority: 70,
    active: focused,
    dismiss: () => setFocused(false),
  }), [focused]));
  useDismissLayer(useMemo(() => ({
    id: "commit-drawer",
    priority: 60,
    active: commitRailOpen,
    dismiss: () => setCommitRailOpen(false),
  }), [commitRailOpen]));
  useDismissLayer(useMemo(() => ({
    id: "change-multi-selection",
    priority: 20,
    active: selectedKeys.size > 1,
    dismiss: () => setSelectedKeys(new Set(selection ? [selectionKey(selection)] : [])),
  }), [selectedKeys.size, selection]));
  useDismissLayer(useMemo(() => ({
    id: "commit-options",
    priority: 110,
    active: commitOptionsOpen,
    dismiss: () => setCommitOptionsOpen(false),
  }), [commitOptionsOpen]));

  const renderGroup = (label: string, group: readonly ChangeEntry[]) => (
    <section className={tw.changeNavigatorGroup}>
      <header>
        <strong>{label}</strong>
        <small>{group.length}</small>
        <span />
        <button
          disabled={group.length === 0}
          onClick={() =>
            void onOperation({
              kind: label === "Staged" ? "unstage" : "stage",
              paths: group.map((entry) => entry.file.path),
            })
          }
        >
          {label === "Staged" ? "Unstage all" : "Stage all"}
        </button>
      </header>
      {group.map((entry) => {
        const folders = entry.file.path.split("/");
        const filename = folders.pop() ?? entry.file.path;
        const active = selection ? hasSameChangeSelection(entry.selection, selection) : false;
        const multiSelected = selectedKeys.has(selectionKey(entry.selection));
        return (
          <button
            aria-current={active ? "true" : undefined}
            aria-pressed={multiSelected}
            className={`${tw.changeNavigatorRow} ${active ? tw.selected : ""} ${multiSelected && !active ? tw.multiSelected : ""}`}
            key={selectionKey(entry.selection)}
            onClick={(event) => selectEntry(event, entry)}
            onDoubleClick={() => setFocused(true)}
            title={entry.file.path}
          >
            <span className={`${tw.statusBadge} ${statusClass(entry.file)}`}>
              {statusLetter(entry.file)}
            </span>
            <Icon name={entry.file.submodule ? "worktree" : "file"} size={13} />
            <span className={`${tw.ellipsis} grid`}>
              <strong className="truncate">{treeMode ? filename : entry.file.path}</strong>
              {treeMode && folders.length > 0 && <small className="truncate">{folders.join("/")}</small>}
            </span>
            <span className={tw.diffStat}>
              <i>+{entry.file.additions ?? 0}</i>
              <b>−{entry.file.deletions ?? 0}</b>
            </span>
          </button>
        );
      })}
    </section>
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
        <div className={tw.changesViewOptions}>
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
        className={tw.iconButton}
        icon={<Icon name="more" size={14} />}
        isIconOnly
        label="View Options"
        size="sm"
        variant="ghost"
      />
    </Popover>
  );

  return (
    <div
      className={`${tw.changesWorkspace} ${toolWindow ? tw.changesToolWindow : ""} ${focused && !toolWindow ? tw.changesWorkspaceFocused : ""} ${commitRailOpen ? tw.commitRailOpen : ""}`}
      style={{
        "--changes-navigator-width": `${navigatorWidth}px`,
        "--commit-rail-width": `${commitRailWidth}px`,
      } as CSSProperties}
    >
      {toolWindow && (
        <header className={tw.commitToolWindowHeader}>
          <strong>Commit</strong>
          <span />
          {viewOptions}
          <button
            aria-label="Close Commit"
            className={tw.iconButton}
            onClick={onCloseToolWindow}
            title="Close"
          >
            <Icon name="close" size={13} />
          </button>
        </header>
      )}
      <aside className={tw.changeNavigator} onKeyDown={handleNavigatorKeyboard} ref={navigator} tabIndex={0}>
        {!toolWindow && (
          <VerticalResizeHandle
            direction={1}
            label="Resize change navigator"
            onChange={onNavigatorWidthChange}
            value={navigatorWidth}
          />
        )}
        <header className={tw.changeNavigatorToolbar}>
          <label>
            <Icon name="search" size={13} />
            <input
              aria-label="Filter changed files"
              data-command-search="changes"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter files"
              ref={searchInput}
              value={query}
            />
          </label>
          <button
            aria-label={treeMode ? "Show flat list" : "Show tree paths"}
            className={tw.iconButton}
            onClick={() => setTreeMode((current) => !current)}
          >
            <Icon name={treeMode ? "folder" : "changes"} size={13} />
          </button>
          {!toolWindow && viewOptions}
          <button
            aria-label="Open commit composer"
            className={`${tw.iconButton} ${tw.commitRailToggle}`}
            hidden={toolWindow}
            onClick={() => setCommitRailOpen(true)}
          >
            <Icon name="commit" size={13} />
          </button>
        </header>
        <div className={tw.changeNavigatorList}>
          {entries.length === 0 ? (
            <div className={tw.emptyState}>Working tree clean.</div>
          ) : filteredEntries.length === 0 ? (
            <div className={tw.emptyState}>No changed files match this filter.</div>
          ) : (
            <>
              {renderGroup("Staged", staged)}
              {renderGroup("Working Tree", worktree)}
            </>
          )}
        </div>
        {selectedEntry && (
          <footer className={tw.changeNavigatorActions}>
            {effectiveSelectedEntries.some((entry) => entry.selection.layer === "worktree") && (
              <button
                onClick={() => void onOperation({
                  kind: "stage",
                  paths: effectiveSelectedEntries.filter((entry) => entry.selection.layer === "worktree").map((entry) => entry.file.path),
                })}
              >
                Stage selected
              </button>
            )}
            {effectiveSelectedEntries.some((entry) => entry.selection.layer === "index") && (
              <button
                onClick={() => void onOperation({
                  kind: "unstage",
                  paths: effectiveSelectedEntries.filter((entry) => entry.selection.layer === "index").map((entry) => entry.file.path),
                })}
              >
                Unstage selected
              </button>
            )}
            <button onClick={() => onInspectFile(selectedEntry.file, selectedEntry.selection.layer, "file")}>View</button>
            <button onClick={() => onInspectFile(selectedEntry.file, selectedEntry.selection.layer, "history")}>History</button>
            <button onClick={() => onInspectFile(selectedEntry.file, selectedEntry.selection.layer, "blame")}>Blame</button>
            {selectedEntry.selection.layer === "worktree" && (
              <button onClick={() => void assign(selectedEntry.file)}>Changelist</button>
            )}
          </footer>
        )}
      </aside>
      {diffPreviewVisible ? <DiffViewer
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
          await onOperation({ kind: "partialPatch", patch: partialPatch, cached, reverse });
        }}
        onFileAction={selectedEntry ? runFileAction : undefined}
        onNextFile={selectedIndex >= 0 && selectedIndex < filteredEntries.length - 1 ? () => moveSelection(1) : undefined}
        onOpenExternally={selectedEntry ? () => onOpenExternally(selectedEntry.file) : undefined}
        onPreferencesChange={onPreferencesChange}
        onPreviousFile={selectedIndex > 0 ? () => moveSelection(-1) : undefined}
        onToggleFocus={() => setFocused((current) => !current)}
        patch={patch}
        preferences={preferences}
        sourceLabel={selection?.layer === "index" ? "HEAD → Index" : "Index → Worktree"}
      /> : (
        <section className={tw.diffPreviewHidden} aria-label="Diff preview hidden">
          <Icon name="changes" size={28} />
          <p>Diff preview is hidden.</p>
          <Button
            label="Show Diff Preview"
            onClick={() => setDiffPreviewVisible(true)}
            size="sm"
            variant="ghost"
          />
        </section>
      )}
      <aside className={tw.commitRail}>
        {!toolWindow && (
          <VerticalResizeHandle
            direction={-1}
            label="Resize commit composer"
            onChange={onCommitRailWidthChange}
            value={commitRailWidth}
          />
        )}
        <header>
          <strong>{toolWindow ? "Commit Message" : "Commit"}</strong>
          <small>{stagedFiles.length} staged</small>
          {!toolWindow && (
            <Button
              className={tw.commitRailClose}
              icon={<Icon name="close" size={13} />}
              isIconOnly
              label="Close commit composer"
              onClick={() => setCommitRailOpen(false)}
              size="sm"
              variant="ghost"
            />
          )}
        </header>
        <div className={tw.changelistBar}>
          <Selector
            isLabelHidden
            label="Commit changelist"
            onChange={(value) => onDraftChange({ ...draft, changelistId: value || null })}
            options={[
              { value: "", label: "Default · staged index" },
              ...changelists.map((changelist) => ({
                value: changelist.id,
                label: `${changelist.name} · ${changelist.paths.length} files`,
              })),
            ]}
            placement="above"
            size="sm"
            value={draft.changelistId ?? ""}
            width="100%"
          />
          <Button
            clickAction={async () => {
              const name = await dialog.input({
                title: "New changelist",
                label: "Changelist name",
                initialValue: "Feature work",
                description: "Creates a local grouping without modifying the Git index.",
              });
              if (!name?.trim()) return;
              const saved = await onSaveChangelist(null, name.trim(), []);
              onDraftChange({ ...draft, changelistId: saved.id });
            }}
            label="New"
            size="sm"
            variant="ghost"
          />
        </div>
        {selectedChangelist && (
          <Button
            className={tw.deleteChangelist}
            clickAction={async () => {
              const accepted = await dialog.confirm({
                title: `Delete changelist “${selectedChangelist.name}”?`,
                description: "Files remain unchanged and return to the default group.",
                impact: `${selectedChangelist.paths.length} assigned files`,
                confirmLabel: "Delete changelist",
                dangerous: true,
              });
              if (!accepted) return;
              await onDeleteChangelist(selectedChangelist.id);
              onDraftChange({ ...draft, changelistId: null });
            }}
            label="Delete selected changelist"
            size="sm"
            variant="destructive"
          />
        )}
        <TextArea
          isLabelHidden
          label="Commit message"
          onChange={(message) => onDraftChange({ ...draft, message })}
          placeholder="Commit message"
          rows={7}
          size="sm"
          value={draft.message}
          width="100%"
        />
        <footer className="flex items-center justify-end gap-2 border-t border-border p-2">
          <Popover
            alignment="end"
            hasAutoFocus
            isOpen={commitOptionsOpen}
            label="Commit options"
            onOpenChange={setCommitOptionsOpen}
            placement="above"
            width={260}
            content={
              <div className="grid gap-1 p-1">
                <CheckboxInput label="Amend" onChange={(amend) => onDraftChange({ ...draft, amend })} size="sm" value={draft.amend} />
                <CheckboxInput label="Sign-off" onChange={(signOff) => onDraftChange({ ...draft, signOff })} size="sm" value={draft.signOff} />
                <CheckboxInput label="GPG sign" onChange={(gpgSign) => onDraftChange({ ...draft, gpgSign })} size="sm" value={draft.gpgSign} />
                <CheckboxInput label="Run hooks" onChange={(runHooks) => onDraftChange({ ...draft, runHooks })} size="sm" value={draft.runHooks} />
                {!selectedChangelist && (
                  <CheckboxInput label="Commit tracked" onChange={(commitAll) => onDraftChange({ ...draft, commitAll })} size="sm" value={draft.commitAll} />
                )}
              </div>
            }
          >
            <Button
              endContent={commitOptionCount > 0 ? <em>{commitOptionCount}</em> : undefined}
              label="Commit options"
              size="sm"
              variant="ghost"
            />
          </Popover>
          <Button
            isDisabled={commitDisabled}
            isLoading={committing}
            label={committing ? "Checking…" : "Commit"}
            onClick={() => void commit(false)}
            size="sm"
            tooltip="Commit · ⌘↩"
          />
          <Button
            isDisabled={commitDisabled}
            isLoading={committing}
            label={committing ? "Checking…" : "Commit & Push"}
            onClick={() => void commit(true)}
            size="sm"
            tooltip="Commit & Push · ⇧⌘↩"
            variant="primary"
          />
        </footer>
      </aside>
      {dialog.node}
    </div>
  );
}
