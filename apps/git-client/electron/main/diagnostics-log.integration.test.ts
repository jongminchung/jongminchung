import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    appendBoundedDiagnosticLog,
    sanitizeDiagnosticLogField,
    sanitizeDiagnosticLogMessage,
} from "./diagnostics-log";

describe("diagnostic log storage", () => {
    it("redacts URL credentials and common token assignments", () => {
        const message = sanitizeDiagnosticLogMessage(
            "https://user:secret@example.test token=plain Authorization: Bearer arbitrary-secret",
        );
        expect(message).toContain("[redacted]");
        expect(message).not.toContain("secret");
        expect(message).not.toContain("plain");
        expect(message).not.toContain("arbitrary-secret");
    });

    it("redacts a long credential before applying the field length limit", () => {
        const secret = "s".repeat(3_000);
        const message = sanitizeDiagnosticLogField(
            `https://user:${secret}@example.test/repository`,
            2_048,
        );
        expect(message).toBe("https://[redacted]@example.test/repository");
        expect(message).not.toContain(secret.slice(0, 128));
    });

    it("rotates to one bounded backup before appending", async () => {
        const directory = await mkdtemp(
            join(tmpdir(), "git-client-diagnostics-log-"),
        );
        const logPath = join(directory, "git-client.log");
        const rotatedPath = join(directory, "git-client.log.1");
        try {
            await writeFile(logPath, "x".repeat(96));
            await appendBoundedDiagnosticLog(directory, "next entry", 128);
            expect(await readFile(rotatedPath, "utf8")).toBe("x".repeat(96));
            expect((await stat(logPath)).size).toBeLessThanOrEqual(128);

            await writeFile(logPath, "y".repeat(96));
            await appendBoundedDiagnosticLog(directory, "latest entry", 128);
            expect(await readFile(rotatedPath, "utf8")).toBe("y".repeat(96));
            expect((await stat(logPath)).size).toBeLessThanOrEqual(128);
        } finally {
            await rm(directory, { force: true, recursive: true });
        }
    });
});
