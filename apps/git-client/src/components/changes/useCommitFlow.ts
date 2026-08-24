import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CommitDraft } from "../../domain/changeReview";
import type { FileChange, StatusModel } from "../../domain/types";
import type {
  Changelist,
  GitOperation,
  PreCommitCheck,
} from "../../shared/contracts/model/index";
import type { useAppDialog } from "../AppDialog";

export type ChangelistMutation = "create" | "delete";

interface CommitFlowOptions {
  readonly changelists: readonly Changelist[];
  readonly dialog: ReturnType<typeof useAppDialog>;
  readonly draft: CommitDraft;
  readonly navigator: RefObject<HTMLElement | null>;
  readonly onCommitChangelist: (
    changelistId: string,
    message: string,
    amend: boolean,
    signOff: boolean,
    gpgSign: boolean,
  ) => Promise<void>;
  readonly onCommitOperation: (operation: GitOperation) => Promise<void>;
  readonly onDeleteChangelist: (changelistId: string) => Promise<void>;
  readonly onDraftChange: (draft: CommitDraft) => void;
  readonly onOpenPush: () => void;
  readonly onPreCommitCheck: () => Promise<PreCommitCheck>;
  readonly onSaveChangelist: (
    id: string | null,
    name: string,
    paths: readonly string[],
  ) => Promise<Changelist>;
  readonly status: StatusModel;
  readonly toolWindow: boolean;
  readonly workspace: RefObject<HTMLDivElement | null>;
}

export function useCommitFlow({
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
}: CommitFlowOptions) {
  const [committing, setCommitting] = useState(false);
  const [changelistMutation, setChangelistMutation] =
    useState<ChangelistMutation | null>(null);
  const [commitRailOpen, setCommitRailOpen] = useState(false);
  const commitComposerOrigin = useRef<HTMLElement | null>(null);
  const changelistMutationRef = useRef<ChangelistMutation | null>(null);
  const selectedChangelist =
    draft.changelistId === null
      ? null
      : (changelists.find((item) => item.id === draft.changelistId) ?? null);
  const stagedFiles = status.changes.filter((file) => file.staged);
  const hasCommitAllChanges =
    draft.commitAll &&
    status.changes.some((file) => file.worktree && file.status !== "untracked");
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
      workspace.current
        ?.querySelector<HTMLTextAreaElement>("[data-commit-message]")
        ?.focus();
    });
  }, [workspace]);

  const openCommitComposer = useCallback((): void => {
    commitComposerOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setCommitRailOpen(true);
    focusCommitMessage();
  }, [focusCommitMessage]);

  const closeCommitComposer = useCallback((): void => {
    if (!toolWindow) setCommitRailOpen(false);
    const origin = commitComposerOrigin.current;
    window.requestAnimationFrame(() => {
      if (origin?.isConnected) origin.focus();
      else navigator.current?.focus();
    });
  }, [navigator, toolWindow]);

  const assign = async (file: FileChange): Promise<void> => {
    const choice = await dialog.input({
      title: "Assign to changelist",
      label: "Changelist name",
      initialValue: changelists[0]?.name ?? "Feature work",
      description: `Moves ${file.path} out of its current changelist.`,
    });
    const name = choice?.trim();
    if (!name) return;
    const existing =
      changelists.find((changelist) => changelist.name === name) ?? null;
    for (const changelist of changelists) {
      if (
        changelist.id !== existing?.id &&
        changelist.paths.includes(file.path)
      ) {
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
        description:
          "Creates a local grouping without modifying the Git index.",
      });
      if (!name?.trim()) return;
      const saved = await onSaveChangelist(null, name.trim(), []);
      onDraftChange({ ...draft, changelistId: saved.id });
    } finally {
      changelistMutationRef.current = null;
      setChangelistMutation(null);
    }
  };

  const deleteSelectedChangelist = async (): Promise<void> => {
    if (changelistMutationRef.current !== null || selectedChangelist === null)
      return;
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
        check.detachedHead
          ? "HEAD is detached; the commit will not belong to a branch."
          : "",
        check.protectedBranch
          ? `Branch ${check.branch ?? ""} is commonly protected.`
          : "",
        check.crlfPaths.length > 0 ? `CRLF: ${check.crlfPaths.join(", ")}` : "",
        check.largeFiles.length > 0
          ? `Over 10 MiB: ${check.largeFiles.join(", ")}`
          : "",
        check.riskyPaths.length > 0
          ? `Risky paths: ${check.riskyPaths.join(", ")}`
          : "",
      ].filter(Boolean);
      if (warnings.length > 0) {
        const accepted = await dialog.confirm({
          title: "Pre-commit checks found warnings",
          description:
            "Review the affected branch and staged paths before creating the commit.",
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
      if (push) onOpenPush();
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

  return {
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
  };
}
