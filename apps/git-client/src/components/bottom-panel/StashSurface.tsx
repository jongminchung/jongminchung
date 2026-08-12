import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { toVoidHandler } from "../../domain/toVoidHandler";
import type { FileChange, StashEntry } from "../../domain/types";
import type { GitOperation } from "../../shared/contracts/model/index";
import type { AppDialogController } from "../AppDialog";
import { Icon } from "../Icon";
import { EmptyState } from "../ProductCollections";

export type StashMutation =
    | "create"
    | "apply"
    | "pop"
    | "branch"
    | "drop"
    | "clear";

export function StashSurface({
    applyStash,
    dialog,
    dropStash,
    mutation,
    onOpenDiff,
    onOperation,
    runMutation,
    stashChanges,
    stashFiles,
    stashes,
    toggleFiles,
}: {
    readonly applyStash: (stash: StashEntry, pop: boolean) => Promise<void>;
    readonly dialog: AppDialogController;
    readonly dropStash: (stash: StashEntry) => Promise<void>;
    readonly mutation: StashMutation | null;
    readonly onOpenDiff: (stash: StashEntry) => void;
    readonly onOperation: (operation: GitOperation) => Promise<void>;
    readonly runMutation: (
        mutation: StashMutation,
        action: () => Promise<void>,
    ) => Promise<void>;
    readonly stashChanges: () => Promise<void>;
    readonly stashFiles: Readonly<Record<string, readonly FileChange[]>>;
    readonly stashes: readonly StashEntry[];
    readonly toggleFiles: (stash: StashEntry) => Promise<void>;
}) {
    return (
        <div
            className={`collectionTool [&_button]:[background:var(--muted)] [&_button]:[border:1px_solid_var(--border)] [&_button]:rounded-sm [&_button]:[height:27px] [&_button]:[padding:0_9px] [&_button]:[white-space:nowrap] [height:100%] [overflow:auto] collectionTool [&_button]:rounded-sm`}
        >
            <div
                className={`collectionIntro [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:10px] [min-height:48px] [padding:8px_14px] [background:var(--muted)] [&_div]:[flex:1] [&_p]:[color:var(--muted-foreground)] [&_p]:[margin:2px_0_0] collectionIntro`}
            >
                <Icon name="stash" size={24} />
                <div>
                    <strong>Git Stash</strong>
                    <p>Native stash entries from refs/stash.</p>
                </div>
                <Button
                    aria-busy={mutation === "create"}
                    disabled={mutation !== null}
                    onClick={() => void stashChanges()}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                >
                    Stash Changes…
                </Button>
                <Button
                    aria-busy={mutation === "clear"}
                    disabled={stashes.length === 0 || mutation !== null}
                    onClick={toVoidHandler(async () => {
                        await runMutation("clear", async () => {
                            const accepted = await dialog.confirm({
                                title: "Clear every stash entry?",
                                description:
                                    "This removes refs/stash and all entries in its reflog.",
                                impact: `${stashes.length} stash entries`,
                                confirmLabel: "Clear stashes",
                                dangerous: true,
                            });
                            if (!accepted) return;
                            await onOperation({ kind: "stashClear" });
                        });
                    })}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                >
                    Clear all…
                </Button>
            </div>
            {stashes.length === 0 ? (
                <EmptyState title="No entries in refs/stash." />
            ) : (
                stashes.map((stash) => (
                    <div
                        className={`stashEntry [border-bottom:1px_solid_var(--border)] [&.collectionRow]:[border-bottom:0] stashEntry`}
                        key={stash.oid}
                    >
                        <div
                            className={`collectionRow [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:10px] [min-height:48px] [padding:8px_14px] [&_div]:[flex:1] [&_small]:[color:var(--disabled-foreground)] [&_small]:[display:block] [&_small]:[margin-top:3px] [border-bottom:0] collectionRow`}
                        >
                            <Icon name="commit" size={16} />
                            <div>
                                <strong>
                                    {stash.selector}: {stash.subject}
                                </strong>
                                <small>
                                    {stash.author} ·{" "}
                                    {new Date(
                                        stash.createdAt * 1000,
                                    ).toLocaleString()}{" "}
                                    · {stash.oid.slice(0, 10)}
                                </small>
                            </div>
                            <Button
                                onClick={() => void toggleFiles(stash)}
                                type="button"
                                className={cn("h-7 px-2.5")}
                                variant="outline"
                                size="sm"
                            >
                                {stashFiles[stash.oid] ? "Hide Files" : "Files"}
                            </Button>
                            <Button
                                onClick={() => onOpenDiff(stash)}
                                type="button"
                                className={cn("h-7 px-2.5")}
                                variant="outline"
                                size="sm"
                            >
                                Show Diff
                            </Button>
                            <Button
                                aria-busy={mutation === "apply"}
                                disabled={mutation !== null}
                                onClick={() => void applyStash(stash, false)}
                                type="button"
                                className={cn("h-7 px-2.5")}
                                variant="outline"
                                size="sm"
                            >
                                Apply
                            </Button>
                            <Button
                                aria-busy={mutation === "pop"}
                                disabled={mutation !== null}
                                onClick={() => void applyStash(stash, true)}
                                type="button"
                                className={cn("h-7 px-2.5")}
                                variant="outline"
                                size="sm"
                            >
                                Pop
                            </Button>
                            <Button
                                aria-busy={mutation === "branch"}
                                disabled={mutation !== null}
                                onClick={toVoidHandler(async () => {
                                    await runMutation("branch", async () => {
                                        const branch = await dialog.input({
                                            title: `Branch from ${stash.selector}`,
                                            label: "New branch name",
                                            initialValue: "stash/",
                                            description:
                                                "Creates the branch at the stash base, applies the stash, then drops it on success.",
                                        });
                                        if (!branch) return;
                                        await onOperation({
                                            kind: "stashBranch",
                                            stash: stash.selector,
                                            branch,
                                        });
                                    });
                                })}
                                type="button"
                                className={cn("h-7 px-2.5")}
                                variant="outline"
                                size="sm"
                            >
                                Branch…
                            </Button>
                            <Button
                                aria-busy={mutation === "drop"}
                                disabled={mutation !== null}
                                onClick={() => void dropStash(stash)}
                                type="button"
                                className={cn("h-7 px-2.5")}
                                variant="outline"
                                size="sm"
                            >
                                Drop
                            </Button>
                        </div>
                        {stashFiles[stash.oid] && (
                            <div
                                className={`stashFiles [background:var(--muted)] [display:grid] [gap:3px] [padding:6px_14px_8px_48px] [&_span]:[color:var(--muted-foreground)] [&_span]:[font-family:var(--font-family-code)] [&_strong]:[color:var(--primary)] [&_strong]:[display:inline-block] [&_strong]:[margin-right:8px] [&_strong]:[width:12px] stashFiles`}
                            >
                                {(stashFiles[stash.oid] ?? []).map((file) => (
                                    <span key={`${stash.oid}-${file.path}`}>
                                        <strong>
                                            {file.status
                                                .charAt(0)
                                                .toUpperCase()}
                                        </strong>
                                        {file.oldPath
                                            ? `${file.oldPath} → `
                                            : ""}
                                        {file.path}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
