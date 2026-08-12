import type {
    HistoryRewritePreview,
    InProgressOperation,
} from "../shared/contracts/model/index";

export interface RecoveryConfirmation {
    readonly title: string;
    readonly description: string;
    readonly impact?: string;
    readonly confirmLabel: string;
    readonly dangerous: true;
}

export function operationDisplayName(operation: InProgressOperation): string {
    return operation === "cherryPick" ? "cherry-pick" : operation;
}

export function abortOperationConfirmation(
    operation: Exclude<InProgressOperation, "bisect">,
    hasResultEdits: boolean,
): RecoveryConfirmation {
    const label = operationDisplayName(operation);
    return {
        title: `Abort ${label}?`,
        description: `Abort the in-progress ${label} and restore the repository state recorded before it started.`,
        impact: hasResultEdits
            ? "Edits in the conflict result pane will also be discarded."
            : undefined,
        confirmLabel: "Abort operation",
        dangerous: true,
    };
}

export function protectedRewriteConfirmation(
    preview: HistoryRewritePreview,
): RecoveryConfirmation {
    return {
        title: `Rewrite protected branch ${preview.branch}?`,
        description:
            "This rewrites local commit IDs. Published commits will require an exact reviewed force-with-lease push.",
        impact: `${preview.descendantCount} commit(s) rewritten\n${preview.publishedCommitCount} published commit(s)\nRecovery will record the pre-rewrite HEAD`,
        confirmLabel: "Start rebase",
        dangerous: true,
    };
}
