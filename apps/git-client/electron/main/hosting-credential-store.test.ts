import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SafeStorageLike } from "./hosting-credential-store";
import { SafeStorageHostingCredentialStore } from "./hosting-credential-store";
import { SettingsStore } from "./settings-store";

const accountId = "00000000-0000-4000-8000-000000000001";
const temporaryDirectories: string[] = [];

function fakeSafeStorage(available = true): SafeStorageLike {
    return {
        isEncryptionAvailable: () => available,
        encryptString: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
        decryptString: (value) => {
            const decoded = value.toString("utf8");
            if (!decoded.startsWith("encrypted:"))
                throw new Error(`bad ciphertext ${decoded}`);
            return decoded.slice("encrypted:".length);
        },
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

describe("SafeStorageHostingCredentialStore", () => {
    it("persists only encrypted ciphertext and restores through safeStorage", async () => {
        const directory = await mkdtemp(
            join(tmpdir(), "git-client-credentials-"),
        );
        temporaryDirectories.push(directory);
        const filePath = join(directory, "settings.json");
        const settings = await SettingsStore.of(filePath);
        const store = new SafeStorageHostingCredentialStore(
            fakeSafeStorage(),
            settings,
        );

        await store.set(accountId, "ghp_super-secret-token");

        await expect(store.get(accountId)).resolves.toBe(
            "ghp_super-secret-token",
        );
        const persisted = await readFile(filePath, "utf8");
        expect(persisted).not.toContain("ghp_super-secret-token");
        expect(persisted).toContain(
            Buffer.from("encrypted:ghp_super-secret-token").toString("base64"),
        );

        const restored = new SafeStorageHostingCredentialStore(
            fakeSafeStorage(),
            await SettingsStore.of(filePath),
        );
        await expect(restored.get(accountId)).resolves.toBe(
            "ghp_super-secret-token",
        );
        await restored.delete(accountId);
        await expect(restored.get(accountId)).resolves.toBeNull();
    });

    it("rejects unavailable encryption, invalid ids, and invalid tokens", async () => {
        const directory = await mkdtemp(
            join(tmpdir(), "git-client-credentials-"),
        );
        temporaryDirectories.push(directory);
        const settings = await SettingsStore.of(
            join(directory, "settings.json"),
        );
        const unavailable = new SafeStorageHostingCredentialStore(
            fakeSafeStorage(false),
            settings,
        );
        await expect(unavailable.set(accountId, "token")).rejects.toMatchObject(
            {
                code: "hosting.credential.unavailable",
            },
        );
        await expect(unavailable.get(accountId)).rejects.toMatchObject({
            code: "hosting.credential.unavailable",
        });
        const store = new SafeStorageHostingCredentialStore(
            fakeSafeStorage(),
            settings,
        );
        await expect(store.set("not-an-id", "token")).rejects.toMatchObject({
            code: "hosting.credential.invalid",
        });
        await expect(store.set(accountId, " \n")).rejects.toMatchObject({
            code: "hosting.credential.invalid",
        });
        await expect(store.set(accountId, "bad\0token")).rejects.toMatchObject({
            code: "hosting.credential.invalid",
        });
    });

    it("does not expose corrupt ciphertext or raw decrypt errors", async () => {
        const directory = await mkdtemp(
            join(tmpdir(), "git-client-credentials-"),
        );
        temporaryDirectories.push(directory);
        const settings = await SettingsStore.of(
            join(directory, "settings.json"),
        );
        await settings.set(
            `hostingCredential:${accountId}`,
            Buffer.from("token-in-error").toString("base64"),
        );
        const store = new SafeStorageHostingCredentialStore(
            fakeSafeStorage(),
            settings,
        );

        const error = await store
            .get(accountId)
            .catch((caught: unknown) => caught);
        expect(error).toMatchObject({ code: "hosting.credential.decrypt" });
        expect(String(error)).not.toContain("token-in-error");
    });
});
