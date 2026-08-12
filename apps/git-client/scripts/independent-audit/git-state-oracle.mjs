#!/usr/bin/env node

import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGit } from "./git-process.mjs";

export async function captureGitState(repositoryPath) {
    const repository = validateRepositoryPath(repositoryPath);
    const [
        headOid,
        symbolicHead,
        refs,
        porcelainV2,
        cachedDiff,
        workingDiff,
        stash,
        remotes,
    ] = await Promise.all([
        gitText(repository, ["rev-parse", "HEAD"]),
        runGit(repository, ["symbolic-ref", "--quiet", "HEAD"], {
            acceptedExitCodes: [0, 1],
        }),
        gitText(repository, [
            "for-each-ref",
            "--format=%(objectname)%00%(refname)",
        ]),
        gitText(repository, ["status", "--porcelain=v2", "--branch", "-z"]),
        gitText(repository, [
            "diff",
            "--binary",
            "--no-ext-diff",
            "--no-renames",
            "--cached",
        ]),
        gitText(repository, [
            "diff",
            "--binary",
            "--no-ext-diff",
            "--no-renames",
        ]),
        gitText(repository, ["stash", "list", "--format=%H%x00%gd%x00%gs"]),
        gitText(repository, ["remote"]),
    ]);

    const remoteNames = lines(remotes).sort(compareText);
    const remoteRefs = await Promise.all(
        remoteNames.map(async (remote) =>
            Object.freeze({
                remote,
                refs: parsePairs(
                    await gitText(repository, ["ls-remote", "--refs", remote]),
                    "\t",
                ),
            }),
        ),
    );

    return Object.freeze({
        schemaVersion: 1,
        head: Object.freeze({
            oid: headOid.trim(),
            ref:
                symbolicHead.exitCode === 0 ? symbolicHead.stdout.trim() : null,
        }),
        refs: parsePairs(refs, "\0"),
        porcelainV2,
        cachedDiff,
        workingDiff,
        stash: lines(stash).map((line) => {
            const [oid, selector, subject] = line.split("\0", 3);
            if (!oid || !selector || subject === undefined) {
                throw new Error(
                    `Could not parse stash entry: ${JSON.stringify(line)}`,
                );
            }
            return Object.freeze({ oid, selector, subject });
        }),
        remoteRefs: Object.freeze(remoteRefs),
    });
}

export function compareGitStates(left, right) {
    const sections = [
        "head",
        "refs",
        "porcelainV2",
        "cachedDiff",
        "workingDiff",
        "stash",
        "remoteRefs",
    ];
    const differences = sections.filter(
        (section) =>
            JSON.stringify(left[section]) !== JSON.stringify(right[section]),
    );
    return Object.freeze({
        equal: differences.length === 0,
        differences: Object.freeze(differences),
    });
}

async function gitText(repositoryPath, args) {
    return (await runGit(repositoryPath, args)).stdout;
}

function validateRepositoryPath(repositoryPath) {
    if (typeof repositoryPath !== "string" || !isAbsolute(repositoryPath)) {
        throw new Error("Repository path must be absolute");
    }
    return resolve(repositoryPath);
}

function lines(value) {
    return value.length === 0 ? [] : value.trimEnd().split("\n");
}

function parsePairs(value, separator) {
    return Object.freeze(
        lines(value)
            .map((line) => {
                const separatorIndex = line.indexOf(separator);
                if (separatorIndex < 1 || separatorIndex === line.length - 1) {
                    throw new Error(
                        `Could not parse Git ref: ${JSON.stringify(line)}`,
                    );
                }
                return Object.freeze({
                    name: line.slice(separatorIndex + separator.length),
                    oid: line.slice(0, separatorIndex),
                });
            })
            .sort((left, right) => compareText(left.name, right.name)),
    );
}

function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function parseCliArguments(args) {
    if (args[0] === "snapshot" && args.length === 2 && isAbsolute(args[1])) {
        return Object.freeze({ command: "snapshot", repository: args[1] });
    }
    if (
        args[0] === "compare" &&
        args.length === 3 &&
        isAbsolute(args[1]) &&
        isAbsolute(args[2])
    ) {
        return Object.freeze({
            command: "compare",
            left: args[1],
            right: args[2],
        });
    }
    throw new Error(
        "Usage: git-state-oracle.mjs snapshot /absolute/repository | compare /absolute/left /absolute/right",
    );
}

const scriptPath = fileURLToPath(import.meta.url);
const isEntryPoint =
    process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath;

if (isEntryPoint) {
    try {
        const input = parseCliArguments(process.argv.slice(2));
        if (input.command === "snapshot") {
            process.stdout.write(
                `${JSON.stringify(await captureGitState(input.repository), null, 2)}\n`,
            );
        } else {
            const [left, right] = await Promise.all([
                captureGitState(input.left),
                captureGitState(input.right),
            ]);
            const result = compareGitStates(left, right);
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
            if (!result.equal) process.exitCode = 2;
        }
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.message : String(error)}\n`,
        );
        process.exitCode = 1;
    }
}
