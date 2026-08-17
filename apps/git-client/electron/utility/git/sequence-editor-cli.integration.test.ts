import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
    GitOperation,
    RebasePlanEntry,
} from "../../../src/shared/contracts/model";
import { SequenceEditorSession } from "./sequence-editor";
import {
    SEQUENCE_EDITOR_APPLICATION_ARGUMENT,
    createApplicationSequenceEditorCommand,
    runSequenceEditorCli,
} from "./sequence-editor-cli";

const temporaryDirectories: string[] = [];

function operation(): GitOperation {
    const entry: RebasePlanEntry = {
        oid: "1".repeat(40),
        subject: "first",
        parents: [],
        action: "reword",
        message: "replacement",
        published: false,
        mergeCommit: false,
    };
    return {
        kind: "interactiveRebase",
        base: null,
        entries: [entry],
        options: {
            autostash: false,
            updateRefs: false,
            preserveMerges: false,
        },
    };
}

async function fixture(): Promise<{
    readonly gitDirectory: string;
    readonly todoPath: string;
}> {
    const root = await mkdtemp(join(tmpdir(), "git-client-sequence-cli-"));
    temporaryDirectories.push(root);
    const gitDirectory = join(root, ".git");
    const rebaseDirectory = join(gitDirectory, "rebase-merge");
    await mkdir(rebaseDirectory, { recursive: true });
    return {
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

describe("runSequenceEditorCli", () => {
    it("[실패]의 확장형을 반대편으로 구성할 수 있는 구조를 구축함", async () => {
        const { gitDirectory } = await fixture();
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation(),
        );

        const command = createApplicationSequenceEditorCommand({
            executablePath:
                "/Applications/Git Client.app/Contents/MacOS/Git Client",
            applicationEntryPath: null,
            mode: "sequence",
            session,
        });

        expect(command).toContain(
            `'${SEQUENCE_EDITOR_APPLICATION_ARGUMENT}' '--sequence-editor'`,
        );
        expect(command).toContain(
            `'${session.payloadPath}' '--nonce' '${session.nonce}'`,
        );
        expect(command).not.toContain("sequence-editor.cjs");
        await session.cleanup();
    });

    it("[성공] 고정된 위치 인수에서 조종사 생성 계획을 적용함", async () => {
        const { gitDirectory, todoPath } = await fixture();
        await writeFile(todoPath, "pick 1111111 first\n", "utf8");
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation(),
        );
        let stderr = "";

        const exitCode = await runSequenceEditorCli(
            [
                "--sequence-editor",
                "--payload",
                session.payloadPath,
                "--nonce",
                session.nonce,
                todoPath,
            ],
            { writeError: (text) => (stderr += text) },
        );

        expect(exitCode).toBe(0);
        expect(stderr).toBe("");
        await expect(readFile(todoPath, "utf8")).resolves.toBe(
            "reword 1111111 first\n",
        );
        await session.cleanup();
    });

    it("[실패], 귀중한 또는 추가 인수를 했습니다", async () => {
        let stderr = "";

        const exitCode = await runSequenceEditorCli(
            ["--sequence-editor", "--payload", "/tmp/payload.json"],
            { writeError: (text) => (stderr += text) },
        );

        expect(exitCode).toBe(2);
        expect(stderr).toContain("Invalid sequence editor arguments");
    });

    it("[성공] 자격 증명을 수정하고 IO 실패 시 nonce를 에코하지 않음", async () => {
        const { gitDirectory, todoPath } = await fixture();
        await writeFile(todoPath, "pick 1111111 first\n", "utf8");
        const secret = "very-secret-token";
        const nonce = "a".repeat(64);
        const missingPayload = join(
            gitDirectory,
            `token=${secret}`,
            "payload.json",
        );
        let stderr = "";

        const exitCode = await runSequenceEditorCli(
            [
                "--sequence-editor",
                "--payload",
                missingPayload,
                "--nonce",
                nonce,
                todoPath,
            ],
            { writeError: (text) => (stderr += text) },
        );

        expect(exitCode).toBe(2);
        expect(stderr).toContain("[redacted]");
        expect(stderr).not.toContain(secret);
        expect(stderr).not.toContain(nonce);
    });

    it("[성공] 믿을 수 없는 할일 콘텐츠로 인해 오류가 발생하면 nonce를 수정함", async () => {
        const { gitDirectory, todoPath } = await fixture();
        const session = await SequenceEditorSession.create(
            gitDirectory,
            operation(),
        );
        await writeFile(
            todoPath,
            `pick ${session.nonce} attacker-controlled\n`,
            "utf8",
        );
        let stderr = "";

        const exitCode = await runSequenceEditorCli(
            [
                "--sequence-editor",
                "--payload",
                session.payloadPath,
                "--nonce",
                session.nonce,
                todoPath,
            ],
            { writeError: (text) => (stderr += text) },
        );

        expect(exitCode).toBe(2);
        expect(stderr).toContain("[redacted]");
        expect(stderr).not.toContain(session.nonce);
        await session.cleanup();
    });
});
