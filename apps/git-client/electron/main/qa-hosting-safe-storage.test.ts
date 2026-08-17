import { describe, expect, it } from "vitest";
import { QaHostingSafeStorage } from "./qa-hosting-safe-storage";

describe("QA 불법 보안 저장", () => {
    it("[실패] 자격 증명을 따르거나 macOS 키체인을 선호하지 않거나 암호를 취급함", () => {
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
