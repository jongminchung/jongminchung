import { Buffer, isUtf8 } from "node:buffer";
import { open } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import { GitRelativePathSchema } from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { GitProcessOutcome } from "./git-process";

export function invalid(message: string): GitUtilityError {
    return new GitUtilityError("invalidInput", message);
}

export function commandFailure(outcome: GitProcessOutcome): GitUtilityError {
    if (outcome.kind === "failed")
        return new GitUtilityError(
            outcome.code,
            outcome.message,
            outcome.exitCode,
        );
    if (outcome.kind === "cancelled") {
        return new GitUtilityError(
            "commandFailed",
            `Local History command was cancelled (${outcome.reason})`,
        );
    }
    return new GitUtilityError(
        "commandFailed",
        "Local History command did not complete successfully",
    );
}

export function processOutput(
    outcome: GitProcessOutcome,
    stream: "stdout" | "stderr",
): string {
    return outcome.output
        .filter((item) => item.stream === stream)
        .map((item) => item.data)
        .join("");
}

export function isErrno(error: unknown, code: string): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === code
    );
}

export async function looksLikeText(path: string): Promise<boolean> {
    const handle = await open(path, "r");
    try {
        const sample = Buffer.alloc(8 * 1024);
        const { bytesRead } = await handle.read(sample, 0, sample.length, 0);
        const bytes = sample.subarray(0, bytesRead);
        return !bytes.includes(0) && isUtf8(bytes);
    } finally {
        await handle.close();
    }
}

export function contained(root: string, candidate: string): boolean {
    const path = relative(root, candidate);
    return (
        path === "" ||
        (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
    );
}

export function parseNul(value: string): readonly string[] {
    if (value.length === 0) return [];
    if (!value.endsWith("\0"))
        throw invalid("Git returned an invalid path list");
    return value
        .slice(0, -1)
        .split("\0")
        .map((path) => GitRelativePathSchema.parse(path));
}

export function parseIndex(value: string): ReadonlyMap<string, string> {
    const result = new Map<string, string>();
    if (value.length > 0 && !value.endsWith("\0"))
        throw invalid("Git returned an invalid index");
    for (const record of value.length === 0
        ? []
        : value.slice(0, -1).split("\0")) {
        const tab = record.indexOf("\t");
        const header = record.slice(0, tab).split(" ");
        const path = record.slice(tab + 1);
        if (tab < 0 || header.length !== 3 || header[2] !== "0") continue;
        const oid = header[1];
        if (oid !== undefined)
            result.set(GitRelativePathSchema.parse(path), oid);
    }
    return result;
}

export function parseDirty(value: string): ReadonlySet<string> {
    const records = value.length === 0 ? [] : value.slice(0, -1).split("\0");
    const paths = new Set<string>();
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        if (record === undefined || record.length < 4) continue;
        const path = GitRelativePathSchema.parse(record.slice(3));
        paths.add(path);
        if (
            record[0] === "R" ||
            record[0] === "C" ||
            record[1] === "R" ||
            record[1] === "C"
        ) {
            const previous = records[index + 1];
            if (previous !== undefined)
                paths.add(GitRelativePathSchema.parse(previous));
            index += 1;
        }
    }
    return paths;
}
