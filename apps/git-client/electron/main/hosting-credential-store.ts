import { Buffer } from "node:buffer";
import { z } from "zod";
import type { HostingCredentialStore } from "../hosting";
import { NativeError } from "../shared/native-error";
import type { SettingsStore } from "./settings-store";

export interface SafeStorageLike {
    isEncryptionAvailable(): boolean;
    encryptString(value: string): Buffer;
    decryptString(value: Buffer): string;
}

const KEY_PREFIX = "hostingCredential:";
const CredentialAccountIdSchema = z.uuid();

function credentialKey(accountId: string): string {
    const result = CredentialAccountIdSchema.safeParse(accountId);
    if (!result.success) {
        throw NativeError.create(
            "hosting.credential.invalid",
            "Hosting account identifier is invalid.",
        );
    }
    return `${KEY_PREFIX}${result.data}`;
}

export class SafeStorageHostingCredentialStore implements HostingCredentialStore {
    readonly #safeStorage: SafeStorageLike;
    readonly #settings: SettingsStore;

    constructor(safeStorage: SafeStorageLike, settings: SettingsStore) {
        this.#safeStorage = safeStorage;
        this.#settings = settings;
    }

    async get(accountId: string): Promise<string | null> {
        this.#requireEncryption();
        const encrypted = this.#settings.get(credentialKey(accountId));
        if (encrypted === null) return null;
        if (typeof encrypted !== "string") {
            throw NativeError.create(
                "hosting.credential.invalid",
                "Stored hosting credential is invalid.",
            );
        }
        try {
            return this.#safeStorage.decryptString(
                Buffer.from(encrypted, "base64"),
            );
        } catch {
            throw NativeError.create(
                "hosting.credential.decrypt",
                "Stored hosting credential could not be decrypted.",
            );
        }
    }

    async set(accountId: string, token: string): Promise<void> {
        if (
            token.trim().length === 0 ||
            token.length > 16_384 ||
            token.includes("\0")
        ) {
            throw NativeError.create(
                "hosting.credential.invalid",
                "Hosting credential must be a non-empty token no longer than 16384 characters.",
            );
        }
        this.#requireEncryption();
        let encrypted: Buffer;
        try {
            encrypted = this.#safeStorage.encryptString(token);
        } catch {
            throw NativeError.create(
                "hosting.credential.encrypt",
                "Hosting credential could not be encrypted.",
            );
        }
        await this.#settings.set(
            credentialKey(accountId),
            encrypted.toString("base64"),
        );
    }

    async delete(accountId: string): Promise<void> {
        await this.#settings.delete(credentialKey(accountId));
    }

    #requireEncryption(): void {
        if (!this.#safeStorage.isEncryptionAvailable()) {
            throw NativeError.create(
                "hosting.credential.unavailable",
                "Secure credential storage is unavailable.",
            );
        }
    }
}
