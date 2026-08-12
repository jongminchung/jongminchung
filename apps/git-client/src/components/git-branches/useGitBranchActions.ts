import { useState } from "react";
import {
    checkoutTarget,
    deleteRefOperation,
    mergeRefOperation,
} from "../../domain/refActions";
import type { Ref } from "../../domain/types";
import type {
    BranchComparison,
    GitOperation,
    RemoteInfo,
} from "../../shared/contracts/model/index";
import { useAppDialog } from "../AppDialog";

interface GitBranchActionsOptions {
    readonly activeRef: Ref | null;
    readonly currentBranch?: string | null;
    readonly onCheckout: (target: string) => Promise<void>;
    readonly onClose: () => void;
    readonly onCompare?: (
        left: string,
        right: string,
    ) => Promise<BranchComparison>;
    readonly onOpenSettings: () => void;
    readonly onOperation?: (operation: GitOperation) => Promise<void>;
    readonly remotes: readonly RemoteInfo[];
}

export function useGitBranchActions({
    activeRef,
    currentBranch,
    onCheckout,
    onClose,
    onCompare,
    onOpenSettings,
    onOperation,
    remotes,
}: GitBranchActionsOptions) {
    const [busy, setBusy] = useState(false);
    const [comparison, setComparison] = useState<BranchComparison | null>(null);
    const [error, setError] = useState<string | null>(null);
    const dialog = useAppDialog();

    const run = async (
        operation: GitOperation,
        close = true,
    ): Promise<void> => {
        if (!onOperation) {
            onClose();
            onOpenSettings();
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onOperation(operation);
            if (close) onClose();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setBusy(false);
        }
    };

    const checkoutActive = async (): Promise<void> => {
        if (!activeRef || activeRef.current) return;
        setBusy(true);
        setError(null);
        try {
            await onCheckout(checkoutTarget(activeRef));
            onClose();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setBusy(false);
        }
    };

    const createBranch = async (): Promise<void> => {
        const name = await dialog.input({
            title: "New Branch",
            label: "Branch name",
            description: `Start point: ${activeRef?.shortName ?? "HEAD"}`,
            placeholder: "feature/name",
            confirmLabel: "Create",
        });
        if (!name) return;
        await run({
            kind: "createBranch",
            name,
            startPoint: activeRef?.name ?? "HEAD",
            checkout: true,
        });
    };

    const checkoutRevision = async (): Promise<void> => {
        const target = await dialog.input({
            title: "Checkout Tag or Revision",
            label: "Tag or revision",
            initialValue: activeRef?.shortName ?? "",
            confirmLabel: "Checkout",
        });
        if (!target) return;
        await onCheckout(target);
        onClose();
    };

    const renameActive = async (): Promise<void> => {
        if (activeRef?.kind !== "local") return;
        const name = await dialog.input({
            title: `Rename ${activeRef.shortName}`,
            label: "New branch name",
            initialValue: activeRef.shortName,
            confirmLabel: "Rename",
        });
        if (!name || name === activeRef.shortName) return;
        await run({
            kind: "renameBranch",
            oldName: activeRef.shortName,
            newName: name,
        });
    };

    const createTag = async (): Promise<void> => {
        const name = await dialog.input({
            title: "New Tag",
            label: "Tag name",
            description: `Revision: ${activeRef?.shortName ?? "HEAD"}`,
            placeholder: "v1.0.0",
            confirmLabel: "Create",
        });
        if (!name) return;
        const message = await dialog.input({
            title: `Tag ${name}`,
            label: "Annotation (optional)",
            allowEmpty: true,
            confirmLabel: "Create Tag",
        });
        if (message === null) return;
        await run({
            kind: "createTag",
            name,
            revision: activeRef?.name ?? "HEAD",
            message: message || null,
        });
    };

    const setUpstream = async (): Promise<void> => {
        if (activeRef?.kind !== "local") return;
        const upstream = await dialog.input({
            title: `Set Upstream for ${activeRef.shortName}`,
            label: "Upstream branch",
            initialValue:
                activeRef.upstream?.replace(/^refs\/remotes\//u, "") ??
                "origin/",
            placeholder: "origin/main",
            confirmLabel: "Set Upstream",
        });
        if (!upstream) return;
        await run({
            kind: "setUpstream",
            branch: activeRef.shortName,
            upstream,
        });
    };

    const addWorktree = async (): Promise<void> => {
        const path = await dialog.input({
            title: "New Worktree",
            label: "Absolute worktree path",
            confirmLabel: "Next",
        });
        if (!path) return;
        const branch = await dialog.input({
            title: "New Worktree",
            label: "New branch (optional)",
            allowEmpty: true,
            description:
                "Leave empty to check out the selected reference in detached mode.",
            confirmLabel: "Add Worktree",
        });
        if (branch === null) return;
        await run({
            kind: "worktreeAdd",
            path,
            branch: branch || null,
            startPoint: activeRef?.name ?? "HEAD",
        });
    };

    const pushActiveTag = async (): Promise<void> => {
        if (activeRef?.kind !== "tag" || !remotes[0]) return;
        await run({
            kind: "pushTag",
            remote: remotes[0].name,
            name: activeRef.shortName,
        });
    };

    const deleteActive = async (): Promise<void> => {
        if (!activeRef || activeRef.current) return;
        const accepted = await dialog.confirm({
            title: `Delete ${activeRef.shortName}?`,
            description:
                activeRef.kind === "remote"
                    ? "Deletes the branch from its remote."
                    : `Deletes the selected ${activeRef.kind}.`,
            impact: activeRef.subject,
            confirmLabel: "Delete",
            dangerous: true,
        });
        if (!accepted) return;
        const operation = deleteRefOperation(activeRef);
        if (operation) await run(operation);
    };

    const compareActive = async (): Promise<void> => {
        if (!onCompare || !currentBranch || !activeRef) return;
        setBusy(true);
        setError(null);
        try {
            setComparison(await onCompare(currentBranch, activeRef.name));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setBusy(false);
        }
    };

    const mergeActive = async (): Promise<void> => {
        if (!activeRef || activeRef.current || !currentBranch) return;
        const accepted = await dialog.confirm({
            title: `Merge ${activeRef.shortName} into ${currentBranch}?`,
            description:
                "Integrates the selected reference into the current branch.",
            impact: activeRef.subject,
            confirmLabel: "Merge",
            dangerous: true,
        });
        if (accepted) await run(mergeRefOperation(activeRef));
    };

    return {
        addWorktree,
        busy,
        checkoutActive,
        checkoutRevision,
        compareActive,
        comparison,
        createBranch,
        createTag,
        deleteActive,
        dialogNode: dialog.node,
        error,
        mergeActive,
        pushActiveTag,
        renameActive,
        run,
        setUpstream,
    };
}
