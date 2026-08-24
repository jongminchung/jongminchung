import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendBoundedDiagnosticLog,
  sanitizeDiagnosticLogField,
  sanitizeDiagnosticLogMessage,
} from "./diagnostics-log";

describe("로그 로그 저장", () => {
  it("[성공] URL 자격 증명 및 처음으로 권한을 수정함", () => {
    const message = sanitizeDiagnosticLogMessage(
      "https://user:secret@example.test token=plain Authorization: Bearer arbitrary-secret",
    );
    expect(message).toContain("[redacted]");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("plain");
    expect(message).not.toContain("arbitrary-secret");
  });

  it("[성공] 필드 길이 제한을 적용하기 전에 긴 자격 증명을 수정함", () => {
    const secret = "s".repeat(3_000);
    const message = sanitizeDiagnosticLogField(
      `https://user:${secret}@example.test/repository`,
      2_048,
    );
    expect(message).toBe("https://[redacted]@example.test/repository");
    expect(message).not.toContain(secret.slice(0, 128));
  });

  it("[성공] 추가하기 전에 하나의 거대한 백업으로 회전함", async () => {
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
