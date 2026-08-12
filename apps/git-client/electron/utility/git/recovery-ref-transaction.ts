import { z } from "zod";
import {
    GitOperationSchema,
    type ValidatedGitOperation,
} from "../../../src/shared/contracts/git-operation";
import type { RecoveryRef } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import type {
    GitProcessCompleted,
    GitProcessOutcome,
    GitProcessRunnerLike,
} from "./git-process";
import { safeErrorMessage } from "./redaction";

export const MAX_RECOVERY_TEXT_CHARACTERS = 16_384;
export const MAX_RECOVERY_DIAGNOSTIC_BYTES = 1024 * 1024;
export const RecoveryObjectIdSchema = z
    .string()
    .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);

export interface AffectedRecoveryRefs {
    readonly operation: string;
    readonly names: readonly string[];
}

function invalid(message: string): GitUtilityError {
    return new GitUtilityError("invalidInput", message);
}

export function hasSafeRecoveryRefStructure(value: string): boolean {
    if (
        value.length === 0 ||
        value.length > 16_384 ||
        value.includes("\0") ||
        value.includes("..") ||
        value.includes("@{") ||
        value.includes("//") ||
        value.endsWith(".") ||
        value.endsWith("/") ||
        value.endsWith(".lock") ||
        value.startsWith(".") ||
        value.startsWith("/")
    ) {
        return false;
    }
    for (const character of value) {
        const codePoint = character.codePointAt(0) ?? 0;
        if (
            codePoint <= 0x20 ||
            codePoint === 0x7f ||
            "~^:?*[\\".includes(character)
        ) {
            return false;
        }
    }
    return true;
}

export function validateRecoveryOperation(
    untrustedOperation: unknown,
): ValidatedGitOperation {
    const result = GitOperationSchema.safeParse(untrustedOperation);
    if (!result.success) throw invalid("Recovery operation is invalid");
    return result.data;
}

export function assertRecoveryNotAborted(
    signal: AbortSignal | undefined,
): void {
    if (signal?.aborted !== true) return;
    const suffix =
        signal.reason === "repositoryClosed"
            ? " because the repository closed"
            : "";
    throw new GitUtilityError(
        "commandFailed",
        `Recovery operation was cancelled${suffix}`,
    );
}

function outcomeText(
    outcome: GitProcessOutcome,
    stream: "stdout" | "stderr",
): string {
    return outcome.output
        .filter((entry) => entry.stream === stream)
        .map((entry) => entry.data)
        .join("");
}

export function recoveryProcessFailure(
    outcome: Exclude<GitProcessOutcome, GitProcessCompleted>,
): GitUtilityError {
    if (outcome.kind === "cancelled") {
        const suffix =
            outcome.reason === "timeout"
                ? " timed out"
                : outcome.reason === "repositoryClosed"
                  ? " was cancelled because the repository closed"
                  : " was cancelled";
        return new GitUtilityError(
            "commandFailed",
            `Recovery Git command${suffix}`,
        );
    }
    const detail = outcomeText(outcome, "stderr") || outcome.message;
    return new GitUtilityError(
        outcome.code,
        safeErrorMessage(detail),
        outcome.exitCode,
    );
}

export async function runRecoveryGit(
    runner: GitProcessRunnerLike,
    repository: string,
    args: readonly string[],
    signal: AbortSignal | undefined,
    stdin?: string,
): Promise<GitProcessCompleted> {
    assertRecoveryNotAborted(signal);
    const outcome = await runner.run(
        {
            cwd: repository,
            args,
            ...(stdin === undefined ? {} : { stdin }),
            redactStdout: false,
            outputLimitBytes: MAX_RECOVERY_DIAGNOSTIC_BYTES,
        },
        signal,
    );
    if (outcome.kind !== "completed") throw recoveryProcessFailure(outcome);
    return outcome;
}

export async function captureOptionalRecoveryGit(
    runner: GitProcessRunnerLike,
    repository: string,
    args: readonly string[],
    missingExitCodes: readonly number[],
    signal: AbortSignal | undefined,
): Promise<string | null> {
    assertRecoveryNotAborted(signal);
    const outcome = await runner.run(
        {
            cwd: repository,
            args,
            redactStdout: false,
            outputLimitBytes: MAX_RECOVERY_DIAGNOSTIC_BYTES,
        },
        signal,
    );
    if (outcome.kind === "completed") {
        const value = outcomeText(outcome, "stdout").trim();
        if (value.includes("\ufffd"))
            throw invalid("Non-UTF-8 Git ref names are unsupported");
        return value;
    }
    if (
        outcome.kind === "failed" &&
        outcome.code === "commandFailed" &&
        outcome.exitCode !== null &&
        missingExitCodes.includes(outcome.exitCode)
    ) {
        return null;
    }
    throw recoveryProcessFailure(outcome);
}

export function affectedRecoveryRefs(
    operation: ValidatedGitOperation,
    currentBranch: string | null,
): AffectedRecoveryRefs | null {
    const current = (label: string): AffectedRecoveryRefs | null =>
        currentBranch === null
            ? null
            : { operation: label, names: [`refs/heads/${currentBranch}`] };
    switch (operation.kind) {
        case "commit":
        case "commitAdvanced":
            return current("commit");
        case "reset":
            return current("reset");
        case "revert":
            return current("revert");
        case "cherryPick":
            return current("cherry-pick");
        case "merge":
            return current("merge");
        case "rebase":
            return current("rebase");
        case "interactiveRebase":
            return current("interactive rebase");
        case "dropCommits":
            return current("drop commits");
        case "squashCommits":
            return current("squash commits");
        case "rewordCommit":
            return current("reword commit");
        case "undoCommit":
            return current("undo commit");
        case "createFixupCommit":
            return current("fixup commit");
        case "createSquashCommit":
            return current("squash commit");
        case "continue":
            return current("continue operation");
        case "skip":
            return current("skip operation");
        case "abort":
            return current("abort operation");
        case "createBranch":
            return {
                operation: "create branch",
                names: [`refs/heads/${operation.name}`],
            };
        case "renameBranch":
            return {
                operation: "rename branch",
                names: [
                    `refs/heads/${operation.oldName}`,
                    `refs/heads/${operation.newName}`,
                ],
            };
        case "deleteBranch":
            return {
                operation: "delete branch",
                names: [`refs/heads/${operation.name}`],
            };
        case "createTag":
            return {
                operation: "create tag",
                names: [`refs/tags/${operation.name}`],
            };
        case "deleteTag":
            return {
                operation: "delete tag",
                names: [`refs/tags/${operation.name}`],
            };
        case "stashPush":
        case "stashApply":
        case "stashDrop":
        case "stashClear":
        case "stashBranch":
            return { operation: "stash", names: ["refs/stash"] };
        default:
            return null;
    }
}

export function createRecoveryRefTransaction(
    targets: readonly RecoveryRef[],
    current: ReadonlyMap<string, string | null>,
): { readonly stdin: string; readonly restoredRefs: readonly string[] } | null {
    const commands: string[] = ["start"];
    const restoredRefs: string[] = [];
    for (const target of targets) {
        const oldOid = current.get(target.name) ?? null;
        if (target.oid === oldOid) continue;
        if (target.oid === null && oldOid !== null)
            commands.push(`delete ${target.name} ${oldOid}`);
        else if (target.oid !== null && oldOid === null)
            commands.push(`create ${target.name} ${target.oid}`);
        else if (target.oid !== null && oldOid !== null)
            commands.push(`update ${target.name} ${target.oid} ${oldOid}`);
        restoredRefs.push(target.name);
    }
    if (restoredRefs.length === 0) return null;
    commands.push("prepare", "commit");
    return { stdin: `${commands.join("\n")}\n`, restoredRefs };
}

export function recoveryRefsEqual(
    left: readonly RecoveryRef[],
    right: readonly RecoveryRef[],
): boolean {
    return (
        left.length === right.length &&
        left.every(
            (reference, index) =>
                reference.name === right[index]?.name &&
                reference.oid === right[index]?.oid,
        )
    );
}
