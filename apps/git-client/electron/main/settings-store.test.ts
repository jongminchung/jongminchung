import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("SettingsStore", () => {
  it("persists typed JSON values and reopens the same snapshot", async () => {
    const filePath = await createSettingsPath();
    const store = await SettingsStore.of(filePath);
    await store.set("layout", { compact: true, widths: [240, 680] });
    await store.set("theme", "Islands Dark");

    const reopened = await SettingsStore.of(filePath);
    expect(reopened.get("layout")).toEqual({ compact: true, widths: [240, 680] });
    expect(reopened.get("theme")).toBe("Islands Dark");
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({
      schemaVersion: 1,
      values: {
        layout: { compact: true, widths: [240, 680] },
        theme: "Islands Dark",
      },
    });
  });

  it("deletes a key without mutating the previous snapshot", async () => {
    const filePath = await createSettingsPath();
    const store = await SettingsStore.of(filePath);
    await store.set("one", 1);
    await store.set("two", 2);
    const before = store.createSnapshot();
    await store.delete("one");

    expect(before).toEqual({ one: 1, two: 2 });
    expect(store.createSnapshot()).toEqual({ two: 2 });
  });

  it("serializes concurrent updates without racing the atomic temporary file", async () => {
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
      schemaVersion: 1,
      values: {
        schemaVersion: 1,
        openRepositoryPaths: ["/tmp/one", "/tmp/two"],
        activeRepositoryPath: "/tmp/two",
        recentRepositories: ["/tmp/two"],
        managementSection: "roots",
      },
    });
  });

  it("rejects corrupt or unsupported documents", async () => {
    const filePath = await createSettingsPath();
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{"schemaVersion":2,"values":{}}', "utf8");

    await expect(SettingsStore.of(filePath)).rejects.toMatchObject({ code: "settings.version" });
  });
});
