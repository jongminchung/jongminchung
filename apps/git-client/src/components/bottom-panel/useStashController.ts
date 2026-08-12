import { useCallback, useRef, useState } from "react";
import type { FileChange, StashEntry } from "../../domain/types";
import type { GitOperation } from "../../shared/contracts/model";
import type { AppDialogController } from "../AppDialog";
import type { StashMutation } from "./StashSurface";

export function useStashController({
    dialog,
    onLoadFiles,
    onOperation,
}: {
    readonly dialog: AppDialogController;
    readonly onLoadFiles: (stash: StashEntry) => Promise<readonly FileChange[]>;
    readonly onOperation: (operation: GitOperation) => Promise<void>;
}) {
    const [files, setFiles] = useState<
        Readonly<Record<string, readonly FileChange[]>>
    >({});
    const [loadError, setLoadError] = useState<string>();
    const [mutation, setMutation] = useState<StashMutation | null>(null);
    const mutationRef = useRef<StashMutation | null>(null);

    const toggleFiles = useCallback(
        async (stash: StashEntry): Promise<void> => {
            setLoadError(undefined);
            if (files[stash.oid]) {
                setFiles((current) => {
                    const next = { ...current };
                    delete next[stash.oid];
                    return next;
                });
                return;
            }
            try {
                const loaded = await onLoadFiles(stash);
                setFiles((current) => ({ ...current, [stash.oid]: loaded }));
            } catch (error) {
                setLoadError(
                    error instanceof Error ? error.message : String(error),
                );
            }
        },
        [files, onLoadFiles],
    );

    const runMutation = useCallback(
        async (
            kind: StashMutation,
            action: () => Promise<void>,
        ): Promise<void> => {
            if (mutationRef.current !== null) return;
            mutationRef.current = kind;
            setMutation(kind);
            try {
                await action();
            } finally {
                mutationRef.current = null;
                setMutation(null);
            }
        },
        [],
    );

    const stashChanges = useCallback(async (): Promise<void> => {
        await runMutation("create", async () => {
            const stashMessage = await dialog.input({
                title: "Stash changes",
                label: "Message (optional)",
                initialValue: "WIP",
                allowEmpty: true,
                description:
                    "Includes untracked files and stores the current index state in the stash.",
                confirmLabel: "Stash",
            });
            if (stashMessage === null) return;
            await onOperation({
                kind: "stashPush",
                message: stashMessage || null,
                includeUntracked: true,
                keepIndex: false,
            });
        });
    }, [dialog, onOperation, runMutation]);

    const apply = useCallback(
        async (stash: StashEntry, pop: boolean): Promise<void> => {
            await runMutation(pop ? "pop" : "apply", async () => {
                const accepted = await dialog.confirm({
                    title: `${pop ? "Pop" : "Apply"} ${stash.selector}?`,
                    description: pop
                        ? "Apply the saved changes and drop the stash only after Git succeeds."
                        : "Apply the saved changes while retaining the stash entry.",
                    impact: stash.subject,
                    confirmLabel: pop ? "Pop stash" : "Apply stash",
                    dangerous: pop,
                });
                if (!accepted) return;
                await onOperation({
                    kind: "stashApply",
                    stash: stash.selector,
                    pop,
                    reinstateIndex: true,
                });
            });
        },
        [dialog, onOperation, runMutation],
    );

    const drop = useCallback(
        async (stash: StashEntry): Promise<void> => {
            await runMutation("drop", async () => {
                const accepted = await dialog.confirm({
                    title: `Drop ${stash.selector}?`,
                    description:
                        "This removes the stash entry from refs/stash.",
                    impact: stash.subject,
                    confirmLabel: "Drop stash",
                    dangerous: true,
                });
                if (!accepted) return;
                await onOperation({ kind: "stashDrop", stash: stash.selector });
            });
        },
        [dialog, onOperation, runMutation],
    );

    return {
        apply,
        drop,
        files,
        loadError,
        mutation,
        runMutation,
        stashChanges,
        toggleFiles,
    };
}
