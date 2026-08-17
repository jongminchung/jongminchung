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
import type {
    GitOperation,
    RebasePlanEntry,
} from "../../../src/shared/contracts/model";
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

describe("현재 편집 세션", () => {
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
        "[성공] 유틸리티에서 생성된 $name 기록 작업을 다시 작성함",
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

    it("[성공] 계획을 인증하고 Git의 할일을 표시하고 나중에 다시 작성함", async () => {
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

    it("[성공] 파일 권한을 유지하면서 todo를 원자적으로 대체함", async () => {
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

    it("[실패] Git의 할 일을 변경하지 않고 위조된 nonce를 가지고 있음", async () => {
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

    it("[실패] 완벽하게 계획이 수정된 페이로드를 보유하고 있음", async () => {
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

    it("[실패] 등록된 Git 외부의 편집기 참가자함", async () => {
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

    it("[실패] 순회 세그먼트를 포함하는 대상에 위치함", async () => {
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

    it("[실패] 포인터 링크 편집기 대상을 찾았습니다", async () => {
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

    it("[실패] null 포인트가 포함된 할 일을 대체하지 않고 그대로 있음", async () => {
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

    it("[실패] 퀸 페이로드 한도보다 큰 작업을 수행함", async () => {
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

    it("[실패] 인증된 계획에는 없는 ID가 있었습니다", async () => {
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

    it("[실패] 존재하지 않는 ID가 포함된 계획을 가지고 있음", async () => {
        const { gitDirectory } = await fixture();
        const malformed = {
            ...planEntry("1", "first"),
            oid: "../not-an-object-id",
        };

        await expect(
            SequenceEditorSession.create(gitDirectory, operation([malformed])),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("[실패]는 모든 계획에서 완벽하게 인증받았습니다", async () => {
        const { gitDirectory } = await fixture();
        const duplicate = planEntry("1", "duplicate");

        await expect(
            SequenceEditorSession.create(
                gitDirectory,
                operation([planEntry("1", "first"), duplicate]),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("[실패] Git의 할 일에서 능숙한 커밋을 받았어요", async () => {
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

    it("[실패] 여러 계획과 일치하는 축약된 할 일이 가능한 ID를 포함하는 항목", async () => {
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

    it("[성공] 비병합 계획 작업을 적용하는 동안 보온 구조를 유지함", async () => {
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

    it("[실패] 일기 예보 데이터와 일치하지 않는 밸브의 일을 처리하고 있음", async () => {
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

    it("[성공] 일치하는 제목에 대해 인증된 재워드 메시지를 작성했습니다", async () => {
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

    it("[실패] 없어 보이지 않고 대체되지 않고 재말하기를 계획하고 있음", async () => {
        const { gitDirectory } = await fixture();

        await expect(
            SequenceEditorSession.create(
                gitDirectory,
                operation([planEntry("1", "first", "reword", "   ")]),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
    });

    it("[실패] 널 바이트가 포함된 내용이 포함되어 있음", async () => {
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

    it("[실패] 권한 파일 제한보다 큰 재워드 주소를 포함함", async () => {
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

    it("[실패] 잘못된 메시지를 해석할 수 있는 단어 제목을 포함함", async () => {
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

    it("[성공] 정리가 검증된 페이로드를 정확히 한 번 제거함", async () => {
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

    it("[실패] 취소하고 임시 쓰기 파일을 작성해야 함", async () => {
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

    it("[실패] 추적을 취소하면 인증된 페이로드를 정리함", async () => {
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

    it("[실패] 조종사 외부에 복사된 인증된 페이로드를 유지함", async () => {
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

    it("[실패] 원래 김치를 표시하는 내용에도 표시 링크가 포함되어 있음", async () => {
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

    it("[실패] 파일 모드가 확장된 페이로드를 가지고 있음", async () => {
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

    it("[실패] 파싱하기 전에 크기가 너무 커서 페이로드를 받았어요", async () => {
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
