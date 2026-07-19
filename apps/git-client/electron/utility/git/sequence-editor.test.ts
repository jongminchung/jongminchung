import {
    chmod,
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    stat,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GitOperation, RebasePlanEntry } from "../../../src/generated";
import {
    MAX_SEQUENCE_EDITOR_FILE_BYTES,
    MAX_SEQUENCE_EDITOR_PAYLOAD_BYTES,
    SequenceEditorSession,
    applySequenceEditor,
} from "./sequence-editor";

const temporaryDirectories: string[] = [];

function planEntry(
    digit: string,
    subject: string,
    action: RebasePlanEntry["action"] = "pick",
    message: string | null = null,
): RebasePlanEntry {
    return {
        oid: digit.repeat(40),
        subject,
        parents: [],
        action,
        message,
        published: false,
        mergeCommit: false,
    };
}

function operation(
    entries: readonly RebasePlanEntry[],
    preserveMerges = false,
): GitOperation {
    return {
        kind: "interactiveRebase",
        base: null,
        entries: [...entries],
        options: {
            autostash: false,
            updateRefs: false,
            preserveMerges,
        },
    };
}

async function fixture(): Promise<{
    readonly root: string;
    readonly gitDirectory: string;
    readonly todoPath: string;
}> {
    const root = await mkdtemp(join(tmpdir(), "git-client-sequence-editor-"));
    temporaryDirectories.push(root);
    const gitDirectory = join(root, ".git");
    const rebaseDirectory = join(gitDirectory, "rebase-merge");
    await mkdir(rebaseDirectory, { recursive: true });
    return {
        root,
        gitDirectory,
        todoPath: join(rebaseDirectory, "git-rebase-todo"),
    };
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe("SequenceEditorSession", () => {
    it.each([
        {
            name: "drop",
            operation: {
                kind: "dropCommits",
                revisions: ["2".repeat(40)],
            } as const,
            expected:
                "pick 1111111 first\ndrop 2222222 second\npick 3333333 third\n",
        },
        {
            name: "squash",
            operation: {
                kind: "squashCommits",
                revisions: ["2".repeat(40), "1".repeat(40)],
            } as const,
            expected:
                "pick 1111111 first\nsquash 2222222 second\npick 3333333 third\n",
        },
        {
            name: "reword",
            operation: {
                kind: "rewordCommit",
                revision: "2".repeat(40),
                message: "replacement subject",
            } as const,
            expected:
                "pick 1111111 first\nreword 2222222 second\npick 3333333 third\n",
        },
    ])(
        "rewrites a utility-created $name history operation",
        async (scenario) => {
            const { gitDirectory, todoPath } = await fixture();
            await writeFile(
                todoPath,
                "pick 1111111 first\npick 2222222 second\npick 3333333 third\n",
                "utf8",
            );
            const session = await SequenceEditorSession.create(
                gitDirectory,
                scenario.operation,
            );

            await applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            });

            await expect(readFile(todoPath, "utf8")).resolves.toBe(
                scenario.expected,
            );
            if (scenario.operation.kind === "rewordCommit") {
                const messagePath = join(dirname(todoPath), "message");
                await writeFile(messagePath, "second\n\n# comment\n", "utf8");
                await applySequenceEditor({
                    mode: "message",
                    payloadPath: session.payloadPath,
                    nonce: session.nonce,
                    targetPath: messagePath,
                });
                await expect(readFile(messagePath, "utf8")).resolves.toBe(
                    "replacement subject\n",
                );
            }
            await session.cleanup();
        },
    );

    it("authenticates a plan and atomically rewrites Git's todo in visual order", async () => {
        const { gitDirectory, todoPath } = await fixture();
        await writeFile(
            todoPath,
            "pick 1111111 first\npick 2222222 second\npick 3333333 third\n\n# Rebase plan\n",
            "utf8",
        );
        const rebaseOperation = operation([
            planEntry("2", "second"),
            planEntry("1", "first"),
            planEntry("3", "third", "fixup"),
        ]);
        const session = await SequenceEditorSession.create(
            gitDirectory,
            rebaseOperation,
        );

        await applySequenceEditor({
            mode: "sequence",
            payloadPath: session.payloadPath,
            nonce: session.nonce,
            targetPath: todoPath,
        });

        await expect(readFile(todoPath, "utf8")).resolves.toBe(
            "pick 2222222 second\npick 1111111 first\nfixup 3333333 third\n\n# Rebase plan\n",
        );
        await session.cleanup();
    });

    it("atomically replaces the todo while preserving its file permissions", async () => {
        const { gitDirectory, todoPath } = await fixture();
        await writeFile(todoPath, "pick 1111111 first\n", "utf8");
        await chmod(todoPath, 0o640);
        const before = await stat(todoPath);
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first", "reword", "replacement")]),
        );

        await applySequenceEditor({
            mode: "sequence",
            payloadPath: session.payloadPath,
            nonce: session.nonce,
            targetPath: todoPath,
        });

        const after = await stat(todoPath);
        expect(after.ino).not.toBe(before.ino);
        expect(after.mode & 0o777).toBe(0o640);
        expect(
            (await readdir(dirname(todoPath))).some((name) =>
                name.startsWith(".git-client-sequence-"),
            ),
        ).toBe(false);
        await session.cleanup();
    });

    it("rejects a forged nonce without changing Git's todo", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: "f".repeat(64),
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "authenticationFailed" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects a payload whose authenticated plan was modified", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );
        const envelope = await readFile(session.payloadPath, "utf8");
        await writeFile(
            session.payloadPath,
            envelope.replace("first", "forged"),
            "utf8",
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "authenticationFailed" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects an editor target outside the registered Git directory", async () => {
        const { root, gitDirectory } = await fixture();
        const outsidePath = join(root, "outside-todo");
        const original = "pick 1111111 first\n";
        await writeFile(outsidePath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: outsidePath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(outsidePath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects a target path containing traversal segments", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const traversalPath = `${dirname(todoPath)}/../rebase-merge/git-rebase-todo`;
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: traversalPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects a symbolic-link editor target", async () => {
        const { root, gitDirectory, todoPath } = await fixture();
        const outsidePath = join(root, "outside-todo");
        const original = "pick 1111111 first\n";
        await writeFile(outsidePath, original, "utf8");
        await symlink(outsidePath, todoPath);
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(outsidePath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects a todo containing a null byte without replacing it", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = Buffer.from("pick 1111111 first\0forged\n", "utf8");
        await writeFile(todoPath, original);
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        expect((await readFile(todoPath)).equals(original)).toBe(true);
        await session.cleanup();
    });

    it("rejects a todo larger than the bounded payload limit", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = Buffer.alloc(MAX_SEQUENCE_EDITOR_FILE_BYTES + 1, 0x61);
        await writeFile(todoPath, original);
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        expect((await readFile(todoPath)).equals(original)).toBe(true);
        await session.cleanup();
    });

    it("rejects an object ID that is not present in the authenticated plan", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 2222222 unknown\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects a plan containing a malformed object ID", async () => {
        const { gitDirectory } = await fixture();
        const malformed = {
            ...planEntry("1", "first"),
            oid: "../not-an-object-id",
        };

        await expect(
            SequenceEditorSession.create(gitDirectory, operation([malformed])),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("rejects duplicate commits in an authenticated plan", async () => {
        const { gitDirectory } = await fixture();
        const duplicate = planEntry("1", "duplicate");

        await expect(
            SequenceEditorSession.create(
                gitDirectory,
                operation([planEntry("1", "first"), duplicate]),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("rejects a duplicate commit in Git's todo", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\npick 1111111 first-again\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects an abbreviated todo object ID that matches multiple plan entries", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick aaaaaaa ambiguous\n";
        await writeFile(todoPath, original, "utf8");
        const first = {
            ...planEntry("a", "first"),
            oid: `${"a".repeat(39)}1`,
        };
        const second = {
            ...planEntry("a", "second"),
            oid: `${"a".repeat(39)}2`,
        };
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([first, second]),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("preserves merge structure while applying non-merge plan actions", async () => {
        const { gitDirectory, todoPath } = await fixture();
        await writeFile(
            todoPath,
            "label onto\npick aaaaaaa first\nmerge -C bbbbbbb side\n",
            "utf8",
        );
        const mergeEntry = {
            ...planEntry("b", "side"),
            mergeCommit: true,
        };
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation(
                [
                    planEntry("a", "first", "reword", "rewritten first"),
                    mergeEntry,
                ],
                true,
            ),
        );

        await applySequenceEditor({
            mode: "sequence",
            payloadPath: session.payloadPath,
            nonce: session.nonce,
            targetPath: todoPath,
        });

        await expect(readFile(todoPath, "utf8")).resolves.toBe(
            "label onto\nreword aaaaaaa first\nmerge -C bbbbbbb side\n",
        );
        await session.cleanup();
    });

    it("rejects a merge todo line without matching merge metadata", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original =
            "label onto\npick aaaaaaa first\nmerge -C bbbbbbb side\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("a", "first"), planEntry("b", "side")], true),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("writes the authenticated reword message for the matching subject", async () => {
        const { gitDirectory } = await fixture();
        const messagePath = join(gitDirectory, "COMMIT_EDITMSG");
        await writeFile(
            messagePath,
            "first\n\nold body\n# Please enter the commit message\n",
            "utf8",
        );
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([
                planEntry(
                    "1",
                    "first",
                    "reword",
                    "replacement subject\n\nreplacement body",
                ),
            ]),
        );

        await applySequenceEditor({
            mode: "message",
            payloadPath: session.payloadPath,
            nonce: session.nonce,
            targetPath: messagePath,
        });

        await expect(readFile(messagePath, "utf8")).resolves.toBe(
            "replacement subject\n\nreplacement body\n",
        );
        await session.cleanup();
    });

    it("rejects a reword plan without a non-empty replacement message", async () => {
        const { gitDirectory } = await fixture();

        await expect(
            SequenceEditorSession.create(
                gitDirectory,
                operation([planEntry("1", "first", "reword", "   ")]),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("rejects a reword message containing a null byte", async () => {
        const { gitDirectory } = await fixture();

        await expect(
            SequenceEditorSession.create(
                gitDirectory,
                operation([
                    planEntry("1", "first", "reword", "subject\0forged"),
                ]),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("rejects a reword message larger than the bounded file limit", async () => {
        const { gitDirectory } = await fixture();

        await expect(
            SequenceEditorSession.create(
                gitDirectory,
                operation([
                    planEntry(
                        "1",
                        "first",
                        "reword",
                        "a".repeat(MAX_SEQUENCE_EDITOR_FILE_BYTES + 1),
                    ),
                ]),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("rejects duplicate reword subjects that could select the wrong message", async () => {
        const { gitDirectory } = await fixture();

        await expect(
            SequenceEditorSession.create(
                gitDirectory,
                operation([
                    planEntry("1", "same", "reword", "first replacement"),
                    planEntry("2", "same", "reword", "second replacement"),
                ]),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("removes its authenticated payload exactly once during cleanup", async () => {
        const { gitDirectory } = await fixture();
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );

        await Promise.all([session.cleanup(), session.cleanup()]);

        await expect(readFile(session.payloadPath)).rejects.toMatchObject({
            code: "ENOENT",
        });
    });

    it("cancels before replacement and leaves no atomic-write temporary file", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );
        const controller = new AbortController();
        controller.abort();

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ code: "cancelled" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        const siblings = await readdir(dirname(todoPath));
        expect(
            siblings.some((name) => name.startsWith(".git-client-sequence-")),
        ).toBe(false);
        await session.cleanup();
    });

    it("cleans up the authenticated payload when its owner cancels", async () => {
        const { gitDirectory } = await fixture();
        const controller = new AbortController();
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
            controller.signal,
        );

        controller.abort();
        await session.cleanup();

        await expect(readFile(session.payloadPath)).rejects.toMatchObject({
            code: "ENOENT",
        });
    });

    it("rejects an authenticated payload copied outside the utility temp root", async () => {
        const { root, gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first", "reword", "replacement")]),
        );
        const forgedDirectory = join(root, "git-client-sequence-forged");
        const forgedPayloadPath = join(forgedDirectory, "payload.json");
        await mkdir(forgedDirectory, { mode: 0o700 });
        await chmod(forgedDirectory, 0o700);
        await writeFile(
            forgedPayloadPath,
            await readFile(session.payloadPath),
            { mode: 0o600 },
        );
        await chmod(forgedPayloadPath, 0o600);

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: forgedPayloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "authenticationFailed" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects a symbolic-link payload even when it points to the original envelope", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first", "reword", "replacement")]),
        );
        const actualPayloadPath = join(session.directory, "payload.actual");
        await rename(session.payloadPath, actualPayloadPath);
        await symlink(actualPayloadPath, session.payloadPath);

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "authenticationFailed" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects a payload whose utility-only file mode was widened", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first", "reword", "replacement")]),
        );
        await chmod(session.payloadPath, 0o700);

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "authenticationFailed" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });

    it("rejects an oversized payload before parsing it", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const original = "pick 1111111 first\n";
        await writeFile(todoPath, original, "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation([planEntry("1", "first")]),
        );
        await writeFile(
            session.payloadPath,
            Buffer.alloc(MAX_SEQUENCE_EDITOR_PAYLOAD_BYTES + 1, 0x61),
        );

        await expect(
            applySequenceEditor({
                mode: "sequence",
                payloadPath: session.payloadPath,
                nonce: session.nonce,
                targetPath: todoPath,
            }),
        ).rejects.toMatchObject({ code: "invalidInput" });
        await expect(readFile(todoPath, "utf8")).resolves.toBe(original);
        await session.cleanup();
    });
});
