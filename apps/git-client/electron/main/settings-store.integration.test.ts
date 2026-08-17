import {
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    rm,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsStore } from "./settings-store";

const temporaryDirectories: string[] = [];

async function createSettingsPath(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "git-client-settings-"));
    temporaryDirectories.push(directory);
    return join(directory, "nested", "settings.json");
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

describe("설정 저장", () => {
    it("[성공] 입력된 JSON 값을 유지하고 적합한 스냅샷을 다시 작성함", async () => {
        const filePath = await createSettingsPath();
        const store = await SettingsStore.of(filePath);
        await store.set("layout", { compact: true, widths: [240, 680] });
        await store.set("theme", "Islands Dark");

        const reopened = await SettingsStore.of(filePath);
        expect(reopened.get("layout")).toEqual({
            compact: true,
            widths: [240, 680],
        });
        expect(reopened.get("theme")).toBe("Islands Dark");
        expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
            schemaVersion: 2,
            values: {
                layout: { compact: true, widths: [240, 680] },
                theme: "Islands Dark",
            },
        });
    });

    it("[실패] 이전 스냅샷을 변경하지 않고 키를 삭제함", async () => {
        const filePath = await createSettingsPath();
        const store = await SettingsStore.of(filePath);
        await store.set("one", 1);
        await store.set("two", 2);
        const before = store.createSnapshot();
        await store.delete("one");

        expect(before).toEqual({ one: 1, two: 2 });
        expect(store.createSnapshot()).toEqual({ two: 2 });
    });

    it("[실패] 오토바이 임시 파일을 경주하지 않고 직접 업데이트를 직렬화함", async () => {
        const filePath = await createSettingsPath();
        const store = await SettingsStore.of(filePath);

        await Promise.all([
            store.set("schemaVersion", 1),
            store.set("openRepositoryPaths", ["/tmp/one", "/tmp/two"]),
            store.set("activeRepositoryPath", "/tmp/two"),
            store.set("recentRepositories", ["/tmp/two"]),
            store.set("managementSection", "roots"),
        ]);

        expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
            schemaVersion: 2,
            values: {
                schemaVersion: 1,
                openRepositoryPaths: ["/tmp/one", "/tmp/two"],
                activeRepositoryPath: "/tmp/two",
                recentRepositories: ["/tmp/two"],
                managementSection: "roots",
            },
        });
    });

    it("[성공] 이전 설정을 백업하고 멤버함", async () => {
        const filePath = await createSettingsPath();
        await mkdir(dirname(filePath), { recursive: true });
        const legacyDocument = '{"schemaVersion":1,"values":{"theme":"Dark"}}';
        await writeFile(filePath, legacyDocument, "utf8");

        const store = await SettingsStore.of(filePath);

        expect(store.createSnapshot()).toEqual({});
        expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
            schemaVersion: 2,
            values: {},
        });
        const files = await readdir(dirname(filePath));
        const backup = files.find((file) =>
            /^settings\.json\.v1\..+\.backup$/u.test(file),
        );
        expect(backup).toBeDefined();
        expect(await readFile(join(dirname(filePath), backup!), "utf8")).toBe(
            legacyDocument,
        );
    });

    it("[실패] 지원되지 않는 문서가 있음", async () => {
        const filePath = await createSettingsPath();
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, '{"schemaVersion":3,"values":{}}', "utf8");

        await expect(SettingsStore.of(filePath)).rejects.toMatchObject({
            code: "settings.version",
        });
    });
});
