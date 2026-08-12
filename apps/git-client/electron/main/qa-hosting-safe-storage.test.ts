import { describe, expect, it } from "vitest";
import { QaHostingSafeStorage } from "./qa-hosting-safe-storage";

describe("QA hosting safe storage", () => {
    it("round-trips ciphertext without exposing the credential or requiring the macOS Keychain", () => {
        const storage = QaHostingSafeStorage.fromSeed(
            Buffer.from("isolated-hosting-fixture"),
        );
        const credential = "ghp_packaged_fixture_secret";

        const encrypted = storage.encryptString(credential);

        expect(encrypted.toString("utf8")).not.toContain(credential);
        expect(storage.decryptString(encrypted)).toBe(credential);
        expect(() =>
            QaHostingSafeStorage.fromSeed(
                Buffer.from("another-fixture"),
            ).decryptString(encrypted),
        ).toThrow();
    });
});
