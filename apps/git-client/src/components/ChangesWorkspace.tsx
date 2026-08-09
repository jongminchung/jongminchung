import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { Toggle } from "@jongminchung/ui/components/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@jongminchung/ui/components/tooltip";
import { cn } from "@jongminchung/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import type {
  ChangeEntry,
  ChangeSelection,
  CommitDraft,
  DiffPreferences,
} from "../domain/changeReview";
import {
  hasSameChangeSelection,
  normalizePartialPatchTarget,
  uniqueChangePaths,
} from "../domain/changeReview";
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
} from "../shared/contracts/model";
import { useAppDialog } from "./AppDialog";
import { useCommandDefinitions, useDismissLayer } from "./CommandProvider";
import { DiffViewer } from "./DiffViewer";
import { Icon } from "./Icon";
import { EmptyState, Spinner, StatusBadge } from "./ProductCollections";
import { CheckboxInput } from "./ProductFormControls";
import { Selector } from "./ProductFormControls";
import { TextArea } from "./ProductFormControls";
import { Popover } from "./ProductOverlays";
import { VerticalResizeHandle } from "./VerticalResizeHandle";

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

function selectionKey(selection: ChangeSelection): string {
  return `${selection.layer}:${selection.path}`;
}

function statusLetter(file: FileChange): string {
  if (file.status === "untracked") return "?";
  if (file.status === "conflicted") return "!";
  return file.status.charAt(0).toUpperCase();
}

function statusClass(file: FileChange): string {
  if (file.status === "added")
    return `statusAdded [background:color-mix(in_oklch,_var(--success)_16%,_transparent)] [color:var(--success)] statusAdded`;
  if (file.status === "deleted")
    return `statusDeleted [background:color-mix(in_oklch,_var(--destructive)_16%,_transparent)] [color:var(--destructive)] statusDeleted`;
  if (file.status === "renamed" || file.status === "copied")
    return `statusRenamed [background:color-mix(in_oklch,_var(--primary)_16%,_transparent)] [color:var(--primary)] statusRenamed`;
  if (file.status === "conflicted")
    return `statusConflict [background:color-mix(in_oklch,_var(--destructive)_16%,_transparent)] [color:var(--destructive)] statusConflict`;
  if (file.status === "untracked")
    return `statusUnknown [background:var(--muted)] [color:var(--muted-foreground)] statusUnknown`;
  return `statusModified [background:color-mix(in_oklch,_var(--primary)_16%,_transparent)] [color:var(--primary)] statusModified`;
}

type ChangelistMutation = "create" | "delete";

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
  const [changelistMutation, setChangelistMutation] = useState<ChangelistMutation | null>(null);
  const [focused, setFocused] = useState(false);
  const [commitRailOpen, setCommitRailOpen] = useState(false);
  const [commitOptionsOpen, setCommitOptionsOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const navigator = useRef<HTMLElement>(null);
  const commitComposerOrigin = useRef<HTMLElement | null>(null);
  const changelistMutationRef = useRef<ChangelistMutation | null>(null);
  const dialog = useAppDialog();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          !normalizedQuery || entry.file.path.toLocaleLowerCase().includes(normalizedQuery),
      ),
    [entries, normalizedQuery],
  );
  const staged = filteredEntries.filter((entry) => entry.selection.layer === "index");
  const worktree = filteredEntries.filter((entry) => entry.selection.layer === "worktree");
  const selectedEntry =
    entries.find((entry) => selection && hasSameChangeSelection(entry.selection, selection)) ??
    null;
  const selectedEntries = entries.filter((entry) =>
    selectedKeys.has(selectionKey(entry.selection)),
  );
  const effectiveSelectedEntries =
    selectedEntries.length > 0 ? selectedEntries : selectedEntry ? [selectedEntry] : [];
  const selectedIndex = selectedEntry ? filteredEntries.indexOf(selectedEntry) : -1;
  const selectedChangelist =
    draft.changelistId === null
      ? null
      : (changelists.find((item) => item.id === draft.changelistId) ?? null);
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

  const focusCommitMessage = useCallback((): void => {
    window.requestAnimationFrame(() => {
      workspace.current?.querySelector<HTMLTextAreaElement>("[data-commit-message]")?.focus();
    });
  }, []);

  const openCommitComposer = useCallback((): void => {
    commitComposerOrigin.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommitRailOpen(true);
    focusCommitMessage();
  }, [focusCommitMessage]);

  const closeCommitComposer = useCallback((): void => {
    setCommitOptionsOpen(false);
    if (!toolWindow) setCommitRailOpen(false);
    const origin = commitComposerOrigin.current;
    window.requestAnimationFrame(() => {
      if (origin?.isConnected) origin.focus();
      else navigator.current?.focus();
    });
  }, [toolWindow]);

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
      const ownsSearch =
        searchInput.current === document.activeElement ||
        navigator.current?.contains(document.activeElement);
      if (!ownsSearch || !query) return;
      const direction = event.detail?.direction === -1 ? -1 : 1;
      if (filteredEntries.length === 0) return;
      const nextIndex =
        (Math.max(0, selectedIndex) + direction + filteredEntries.length) % filteredEntries.length;
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
      const anchorIndex = filteredEntries.findIndex(
        (candidate) => selectionKey(candidate.selection) === anchor,
      );
      const targetIndex = filteredEntries.findIndex(
        (candidate) => selectionKey(candidate.selection) === key,
      );
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const [start, end] =
          anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        setSelectedKeys(
          new Set(
            filteredEntries
              .slice(start, end + 1)
              .map((candidate) => selectionKey(candidate.selection)),
          ),
        );
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

  const discardSelectedChanges = async (): Promise<void> => {
    const discardable = effectiveSelectedEntries.filter(
      (entry) => entry.selection.layer === "worktree" && entry.file.status !== "conflicted",
    );
    const paths = uniqueChangePaths(discardable, "worktree");
    if (paths.length === 0) return;
    const accepted = await dialog.confirm({
      title:
        paths.length === 1 ? `Discard changes in ${paths[0]}?` : `Discard ${paths.length} files?`,
      description: "Restore each selected working-tree path to its indexed version.",
      impact: "Uncommitted working-tree edits will be lost.",
      confirmLabel: "Discard changes",
      dangerous: true,
    });
    if (!accepted) return;
    await onOperation({ kind: "discard", paths: [...paths] });
  };

  useEffect(() => {
    if (!selection) {
      setSelectedKeys(new Set());
      setSelectionAnchor(null);
      return;
    }
    const key = selectionKey(selection);
    setSelectedKeys((current) => (current.size > 1 ? current : new Set([key])));
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
    const saved = await onSaveChangelist(existing?.id ?? null, name, [
      ...(existing?.paths ?? []),
      file.path,
    ]);
    onDraftChange({ ...draft, changelistId: saved.id });
  };

  const createChangelist = async (): Promise<void> => {
    if (changelistMutationRef.current !== null) return;
    changelistMutationRef.current = "create";
    setChangelistMutation("create");
    try {
      const name = await dialog.input({
        title: "New changelist",
        label: "Changelist name",
        initialValue: "Feature work",
        description: "Creates a local grouping without modifying the Git index.",
      });
      if (!name?.trim()) return;
      const saved = await onSaveChangelist(null, name.trim(), []);
      onDraftChange({
        ...draft,
        changelistId: saved.id,
      });
    } finally {
      changelistMutationRef.current = null;
      setChangelistMutation(null);
    }
  };

  const deleteSelectedChangelist = async (): Promise<void> => {
    if (changelistMutationRef.current !== null || selectedChangelist === null) return;
    changelistMutationRef.current = "delete";
    setChangelistMutation("delete");
    try {
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
    } finally {
      changelistMutationRef.current = null;
      setChangelistMutation(null);
    }
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
  const changeCommands = useMemo<readonly CommandDefinition[]>(
    () => [
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
              : commandDisabled("Enter a commit message and stage at least one file."),
      ),
      commandDefinition(
        "changes.commitPush",
        () => commit(true),
        () =>
          committing
            ? commandDisabled("A commit is already in progress.")
            : canCommit
              ? COMMAND_ENABLED
              : commandDisabled("Enter a commit message and stage at least one file."),
      ),
    ],
    [canCommit, commit, committing, runFileAction, selectedEntry],
  );
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
        dismiss: () => setSelectedKeys(new Set(selection ? [selectionKey(selection)] : [])),
      }),
      [selectedKeys.size, selection],
    ),
  );
  useDismissLayer(
    useMemo(
      () => ({
        id: "commit-options",
        priority: 110,
        active: commitOptionsOpen,
        dismiss: () => setCommitOptionsOpen(false),
      }),
      [commitOptionsOpen],
    ),
  );

  const renderGroup = (label: string, group: readonly ChangeEntry[]) => (
    <section
      className={`changeNavigatorGroup [&>_header]:[align-items:center] [&>_header]:[background:var(--secondary)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[border-top:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:6px] [&>_header]:[height:29px] [&>_header]:[padding:0_7px] [&>_header]:[position:sticky] [&>_header]:[top:0] [&>_header]:[z-index:2] [&:first-child_>_header]:[border-top:0] [&>_header_small]:[color:var(--disabled-foreground)] [&>_header_span]:[flex:1] [&>_header_button]:[background:transparent] [&>_header_button]:[color:var(--primary)] [&>_header_button]:[padding:0_5px] changeNavigatorGroup`}
    >
      <header>
        <strong>{label}</strong>
        <small>{group.length}</small>
        <span />
        <Button
          disabled={group.length === 0}
          onClick={() =>
            void onOperation({
              kind: label === "Staged" ? "unstage" : "stage",
              paths: group.map((entry) => entry.file.path),
            })
          }
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          {label === "Staged" ? "Unstage all" : "Stage all"}
        </Button>
      </header>
      {group.map((entry) => {
        const folders = entry.file.path.split("/");
        const filename = folders.pop() ?? entry.file.path;
        const active = selection ? hasSameChangeSelection(entry.selection, selection) : false;
        const multiSelected = selectedKeys.has(selectionKey(entry.selection));
        return (
          <Tooltip key={selectionKey(entry.selection)}>
            <TooltipTrigger
              render={
                <Toggle
                  aria-current={active ? "true" : undefined}
                  onClick={(event) => selectEntry(event, entry)}
                  onDoubleClick={() => setFocused(true)}
                  pressed={multiSelected}
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 min-h-[29px] w-full justify-start whitespace-normal rounded-sm px-2 py-1 text-left aria-selected:bg-accent aria-current:bg-accent",
                    `${`changeNavigatorRow [align-items:center] [background:transparent] rounded-none! [display:flex] [gap:5px] [min-height:29px] [padding:3px_7px] [text-align:left] [width:100%] [&.selected]:[background:var(--accent)] [&[aria-current=true]]:[background:var(--accent)] [&.multiSelected]:[background:color-mix(in_oklch,_var(--accent)_62%,_transparent)] [&_small]:[color:var(--disabled-foreground)] changeNavigatorRow rounded-none!`} ${active ? `selected [background:var(--accent)] [color:var(--foreground)] selected` : ""} ${multiSelected && !active ? `multiSelected [background:color-mix(in_oklch,_var(--accent)_62%,_transparent)] multiSelected` : ""}`,
                  )}
                >
                  <StatusBadge className={statusClass(entry.file)}>
                    {statusLetter(entry.file)}
                  </StatusBadge>
                  <Icon name={entry.file.submodule ? "worktree" : "file"} size={13} />
                  <span
                    className={`${`ellipsis [min-width:0] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap] ellipsis`} grid`}
                  >
                    <strong className="truncate">{treeMode ? filename : entry.file.path}</strong>
                    {treeMode && folders.length > 0 && (
                      <small className="truncate">{folders.join("/")}</small>
                    )}
                  </span>
                  <span
                    className={`diffStat [display:flex] [font-size:9px] [gap:4px] [margin-left:auto] [&_i]:[color:var(--success)] [&_i]:[font-style:normal] [&_b]:[color:var(--destructive)] [&_b]:[font-weight:400] diffStat`}
                  >
                    <i>+{entry.file.additions ?? 0}</i>
                    <b>−{entry.file.deletions ?? 0}</b>
                  </span>
                </Toggle>
              }
            />
            <TooltipContent>{entry.file.path}</TooltipContent>
          </Tooltip>
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
        <div
          className={`changesViewOptions [display:grid] [gap:3px] [padding:5px] [&>_strong]:[color:var(--muted-foreground)] [&>_strong]:[font-size:10px] [&>_strong]:[font-weight:600] [&>_strong]:[margin:5px_6px_2px] [&>_strong:not(:first-child)]:[border-top:1px_solid_var(--border)] [&>_strong:not(:first-child)]:[padding-top:7px] changesViewOptions`}
        >
          <strong>Group By</strong>
          <CheckboxInput label="Directory" onChange={setTreeMode} size="sm" value={treeMode} />
          <CheckboxInput isDisabled label="Repository" size="sm" value={false} />
          <strong>View</strong>
          <CheckboxInput
            label="Preview Diff"
            onChange={setDiffPreviewVisible}
            size="sm"
            value={diffPreviewVisible}
          />
          <CheckboxInput isDisabled label="Ignored Files" size="sm" value={false} />
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
      className={`${`changesWorkspace [background:var(--card)] [display:grid] [grid-template-columns:minmax(190px,_var(--changes-navigator-width,_250px))_minmax(420px,_1fr)_minmax(280px,_var(--commit-rail-width,_315px))] [min-height:0] [min-width:0] max-[1120px]:[grid-template-columns:minmax(210px,_245px)_minmax(0,_1fr)] max-[1120px]:[position:relative] max-[1120px]:[&>_.commitRail]:[bottom:0] max-[1120px]:[&>_.commitRail]:[box-shadow:var(--shadow-lg)] max-[1120px]:[&>_.commitRail]:[position:absolute] max-[1120px]:[&>_.commitRail]:[right:0] max-[1120px]:[&>_.commitRail]:[top:0] max-[1120px]:[&>_.commitRail]:[transform:translateX(102%)] max-[1120px]:[&>_.commitRail]:[transition:transform_120ms_ease-out] max-[1120px]:[&>_.commitRail]:[width:min(var(--commit-rail-width,_340px),_calc(100%_-_220px))] max-[1120px]:[&>_.commitRail]:[z-index:15] max-[1120px]:[&.commitRailOpen_>_.commitRail]:[transform:translateX(0)] changesWorkspace`} ${toolWindow ? `changesToolWindow rounded-xl [grid-template-columns:minmax(0,_1fr)]! [grid-template-rows:29px_minmax(150px,_3fr)_minmax(120px,_2fr)] [overflow:hidden] max-[1120px]:[grid-template-columns:minmax(0,_1fr)]! max-[1120px]:[position:relative] [&>_.changeNavigator]:[border-bottom:1px_solid_var(--border)] [&>_.changeNavigator]:[border-right:0] [&>_.diffViewer]:[display:none] [&>_.focusedDiffViewer]:[display:grid] [&>_.commitRail]:[border-left:0] [&>_.commitRail]:[border-top:1px_solid_var(--border)] [&>_.commitRail]:[padding:6px] max-[1120px]:[&>_.commitRail]:[box-shadow:none] max-[1120px]:[&>_.commitRail]:[position:relative] max-[1120px]:[&>_.commitRail]:[transform:none] max-[1120px]:[&>_.commitRail]:[width:auto] changesToolWindow rounded-lg` : ""} ${focused && !toolWindow ? `changesWorkspaceFocused [grid-template-columns:0_minmax(0,_1fr)_0] [&>_.changeNavigator]:[overflow:hidden] [&>_.changeNavigator]:[visibility:hidden] [&>_.commitRail]:[overflow:hidden] [&>_.commitRail]:[visibility:hidden] changesWorkspaceFocused` : ""} ${commitRailOpen ? "commitRailOpen" : ""}`}
      ref={workspace}
      style={
        {
          "--changes-navigator-width": `${navigatorWidth}px`,
          "--commit-rail-width": `${commitRailWidth}px`,
        } as CSSProperties
      }
    >
      {toolWindow && (
        <header
          className={`commitToolWindowHeader [align-items:center] [background:var(--secondary)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:2px] [height:29px] [padding:0_5px_0_8px] [&>_strong]:[font-size:11px] [&>_span]:[flex:1] commitToolWindowHeader`}
        >
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
      <aside
        aria-label="Changed files"
        className={`changeNavigator [border-right:1px_solid_var(--border)] [display:grid] [grid-template-rows:38px_minmax(0,_1fr)_auto] [min-height:0] [min-width:0] [outline:0] [position:relative] changeNavigator`}
        onKeyDown={handleNavigatorKeyboard}
        ref={navigator}
        tabIndex={0}
      >
        {!toolWindow && (
          <VerticalResizeHandle
            direction={1}
            label="Resize change navigator"
            onChange={onNavigatorWidthChange}
            value={navigatorWidth}
          />
        )}
        <header
          className={`changeNavigatorToolbar [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:4px] [padding:5px_6px] [&>_label]:[align-items:center] [&>_label]:[background:var(--secondary)] [&>_label]:[border:1px_solid_var(--border)] [&>_label]:rounded-lg [&>_label]:[display:flex] [&>_label]:[flex:1] [&>_label]:[gap:5px] [&>_label]:[height:27px] [&>_label]:[padding:0_7px] [&>_label:focus-within]:[border-color:var(--primary)] [&>_label:focus-within]:[box-shadow:0_0_0_2px_color-mix(in_oklch,_var(--primary)_22%,_transparent)] [&_input]:[background:transparent] [&_input]:[border:0] [&_input]:[min-width:0] [&_input]:[outline:0] [&_input]:[width:100%] changeNavigatorToolbar [&>_label]:rounded-lg`}
        >
          <label>
            <Icon name="search" size={13} />
            <Input
              aria-label="Filter changed files"
              data-command-search="changes"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter files"
              ref={searchInput}
              value={query}
            />
          </label>
          <Toggle
            aria-label={treeMode ? "Show flat list" : "Show tree paths"}
            onPressedChange={setTreeMode}
            pressed={treeMode}
            type="button"
            className="size-7 p-0 text-muted-foreground"
            size="sm"
          >
            <Icon name={treeMode ? "folder" : "changes"} size={13} />
          </Toggle>
          {!toolWindow && viewOptions}
          <Button
            aria-label="Open commit composer"
            hidden={toolWindow}
            onClick={openCommitComposer}
            type="button"
            className="text-muted-foreground [display:none]! max-[1120px]:[display:inline-flex]!"
            variant="ghost"
            size="icon-sm"
          >
            <Icon name="commit" size={13} />
          </Button>
        </header>
        <div className={`changeNavigatorList [min-height:0] [overflow:auto] changeNavigatorList`}>
          {entries.length === 0 ? (
            <EmptyState title="Working tree clean." />
          ) : filteredEntries.length === 0 ? (
            <EmptyState title="No changed files match this filter." />
          ) : (
            <>
              {renderGroup("Staged", staged)}
              {renderGroup("Working Tree", worktree)}
            </>
          )}
        </div>
        {selectedEntry && (
          <footer
            className={`changeNavigatorActions [border-top:1px_solid_var(--border)] [display:flex] [flex-wrap:wrap] [gap:4px] [padding:5px] [&_button]:[background:transparent] [&_button]:[color:var(--muted-foreground)] [&_button]:[min-height:25px] [&_button]:[padding:0_6px] changeNavigatorActions`}
          >
            {effectiveSelectedEntries.some((entry) => entry.selection.layer === "worktree") && (
              <Button
                onClick={() =>
                  void onOperation({
                    kind: "stage",
                    paths: effectiveSelectedEntries
                      .filter((entry) => entry.selection.layer === "worktree")
                      .map((entry) => entry.file.path),
                  })
                }
                type="button"
                className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
                variant="ghost"
                size="default"
              >
                Stage selected
              </Button>
            )}
            {effectiveSelectedEntries.some(
              (entry) => entry.selection.layer === "worktree" && entry.file.status !== "conflicted",
            ) && (
              <Button
                onClick={() => void discardSelectedChanges()}
                type="button"
                className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
                variant="ghost"
                size="default"
              >
                Discard…
              </Button>
            )}
            {effectiveSelectedEntries.some((entry) => entry.selection.layer === "index") && (
              <Button
                onClick={() =>
                  void onOperation({
                    kind: "unstage",
                    paths: effectiveSelectedEntries
                      .filter((entry) => entry.selection.layer === "index")
                      .map((entry) => entry.file.path),
                  })
                }
                type="button"
                className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
                variant="ghost"
                size="default"
              >
                Unstage selected
              </Button>
            )}
            <Button
              onClick={() =>
                onInspectFile(selectedEntry.file, selectedEntry.selection.layer, "file")
              }
              type="button"
              className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
              variant="ghost"
              size="default"
            >
              View
            </Button>
            <Button
              onClick={() =>
                onInspectFile(selectedEntry.file, selectedEntry.selection.layer, "history")
              }
              type="button"
              className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
              variant="ghost"
              size="default"
            >
              History
            </Button>
            <Button
              onClick={() =>
                onInspectFile(selectedEntry.file, selectedEntry.selection.layer, "blame")
              }
              type="button"
              className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
              variant="ghost"
              size="default"
            >
              Blame
            </Button>
            {selectedEntry.selection.layer === "worktree" && (
              <Button
                onClick={() => void assign(selectedEntry.file)}
                type="button"
                className={cn("gap-1.5 text-xs min-h-[25px] px-1.5 text-muted-foreground")}
                variant="ghost"
                size="default"
              >
                Changelist
              </Button>
            )}
          </footer>
        )}
      </aside>
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
          onOpenExternally={selectedEntry ? () => onOpenExternally(selectedEntry.file) : undefined}
          onPreferencesChange={onPreferencesChange}
          onPreviousFile={selectedIndex > 0 ? () => moveSelection(-1) : undefined}
          onToggleFocus={() => setFocused((current) => !current)}
          patch={patch}
          preferences={preferences}
          sourceLabel={selection?.layer === "index" ? "HEAD → Index" : "Index → Worktree"}
        />
      ) : (
        <section
          className={`diffPreviewHidden [align-items:center] [background:var(--card)] [color:var(--muted-foreground)] [display:flex] [flex-direction:column] [gap:7px] [justify-content:center] [min-height:0] [&>_p]:[margin:0] diffPreviewHidden`}
          aria-label="Diff preview hidden"
        >
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
      <aside
        className={`commitRail [border-left:1px_solid_var(--border)] [display:grid] [gap:7px] [grid-template-rows:34px_auto_auto_minmax(110px,_1fr)_auto] [min-height:0] [min-width:0] [padding:7px] [position:relative] [&>_.verticalResizeHandle]:[left:-4px] [&>_.verticalResizeHandle]:[right:auto] [&>_header]:[align-items:center] [&>_header]:[display:flex] [&>_header]:[gap:6px] [&>_header_small]:[color:var(--disabled-foreground)] [&>_header_small]:[margin-left:auto] [&_textarea]:[background:var(--secondary)] [&_textarea]:[border:1px_solid_var(--border)] [&_textarea]:[min-height:110px] [&_textarea]:[padding:9px] [&_textarea]:[resize:none] [&>_footer]:[align-items:center] [&>_footer]:[border-top:1px_solid_var(--border)] [&>_footer]:[display:grid] [&>_footer]:[gap:5px] [&>_footer]:[grid-template-columns:minmax(0,_1fr)_auto_auto] [&>_footer]:[padding-top:7px] [&>_footer_>_button]:[background:var(--secondary)] [&>_footer_>_button]:[border:1px_solid_var(--border)] [&>_footer_>_button]:[min-height:29px] [&>_footer_>_button]:[padding:0_9px] max-[1120px]:[bottom:0] max-[1120px]:[box-shadow:var(--shadow-lg)] max-[1120px]:[position:absolute] max-[1120px]:[right:0] max-[1120px]:[top:0] max-[1120px]:[transform:translateX(102%)] max-[1120px]:[transition:transform_120ms_ease-out] max-[1120px]:[width:min(var(--commit-rail-width,_340px),_calc(100%_-_220px))] max-[1120px]:[z-index:15] max-[1120px]:[&>_.verticalResizeHandle]:[display:none] commitRail`}
      >
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
              onClick={closeCommitComposer}
              type="button"
              aria-label={"Close commit composer"}
              className="aspect-square h-[26px] min-w-[26px] px-0 [display:none]! max-[1120px]:[display:inline-flex]!"
              variant="ghost"
              size="icon-sm"
            >
              <Icon name="close" size={13} />
            </Button>
          )}
        </header>
        <div
          className={`changelistBar [display:flex] [gap:5px] [min-width:0] [padding-bottom:5px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-sm [&_select]:[flex:1] [&_select]:[min-width:0] [&_select]:[padding:0_6px] [&_button]:[height:24px] changelistBar [&_select]:rounded-sm`}
        >
          <Selector
            isLabelHidden
            label="Commit changelist"
            onChange={(value) =>
              onDraftChange({
                ...draft,
                changelistId: value || null,
              })
            }
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
            type="button"
            aria-busy={changelistMutation === "create"}
            disabled={changelistMutation !== null}
            onClick={() => void createChangelist()}
            className={cn("h-7 px-2.5")}
            variant="ghost"
            size="sm"
          >
            {changelistMutation === "create" ? (
              <Spinner label="Creating changelist…" size="sm" />
            ) : (
              "New"
            )}
          </Button>
        </div>
        {selectedChangelist && (
          <Button
            type="button"
            aria-busy={changelistMutation === "delete"}
            disabled={changelistMutation !== null}
            onClick={() => void deleteSelectedChangelist()}
            className={cn(
              "h-7 px-2.5 border-border bg-secondary shadow-xs hover:border-destructive hover:bg-destructive-muted active:bg-destructive-muted/80",
              "w-full",
              "deleteChangelistButton [grid-row:3]",
            )}
            variant="destructive"
            size="sm"
          >
            {changelistMutation === "delete" ? (
              <Spinner label="Deleting changelist…" size="sm" />
            ) : (
              "Delete selected changelist"
            )}
          </Button>
        )}
        <TextArea
          fieldClassName={
            "commitMessageField [grid-row:4] h-full min-h-0 [&>span]:h-full [&>span]:min-h-0 [&_textarea]:h-full [&_textarea]:min-h-0"
          }
          data-commit-message
          isLabelHidden
          label="Commit message"
          onChange={(message) => onDraftChange({ ...draft, message })}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            closeCommitComposer();
          }}
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
                <CheckboxInput
                  label="Amend"
                  onChange={(amend) => {
                    onDraftChange({ ...draft, amend });
                    focusCommitMessage();
                  }}
                  size="sm"
                  value={draft.amend}
                />
                <CheckboxInput
                  label="Sign-off"
                  onChange={(signOff) => onDraftChange({ ...draft, signOff })}
                  size="sm"
                  value={draft.signOff}
                />
                <CheckboxInput
                  label="GPG sign"
                  onChange={(gpgSign) => onDraftChange({ ...draft, gpgSign })}
                  size="sm"
                  value={draft.gpgSign}
                />
                <CheckboxInput
                  label="Run hooks"
                  onChange={(runHooks) => onDraftChange({ ...draft, runHooks })}
                  size="sm"
                  value={draft.runHooks}
                />
                {!selectedChangelist && (
                  <CheckboxInput
                    label="Commit tracked"
                    onChange={(commitAll) =>
                      onDraftChange({
                        ...draft,
                        commitAll,
                      })
                    }
                    size="sm"
                    value={draft.commitAll}
                  />
                )}
              </div>
            }
          >
            <Button type="button" className={cn("h-7 px-2.5")} variant="ghost" size="sm">
              Commit options
              {commitOptionCount > 0 ? <em>{commitOptionCount}</em> : undefined}
            </Button>
          </Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() => void commit(false)}
                  type="button"
                  aria-busy={committing}
                  disabled={commitDisabled || committing}
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  {committing ? "Checking…" : "Commit"}
                </Button>
              }
            />
            <TooltipContent>Commit · ⌘↩</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() => void commit(true)}
                  type="button"
                  aria-busy={committing}
                  disabled={commitDisabled || committing}
                  className={cn("h-7 px-2.5")}
                  variant="default"
                  size="sm"
                >
                  {committing ? "Checking…" : "Commit & Push"}
                </Button>
              }
            />
            <TooltipContent>Commit &amp; Push · ⇧⌘↩</TooltipContent>
          </Tooltip>
        </footer>
      </aside>
      {dialog.node}
    </div>
  );
}
