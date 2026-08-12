import { appendFile, lstat, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { redactHostingCredentials } from "../../src/shared/contracts/hosting-redaction";

export const MAX_DIAGNOSTIC_LOG_BYTES = 4 * 1_024 * 1_024;
const MAX_DIAGNOSTIC_LOG_LINE_CHARACTERS = 16_384;
const LOG_FILE_NAME = "git-client.log";
const ROTATED_LOG_FILE_NAME = `${LOG_FILE_NAME}.1`;

export function sanitizeDiagnosticLogMessage(message: string): string {
    const redactedAuthorization = message.replace(
        /\b(authorization\s*:\s*(?:basic|bearer)\s+)[^\s"',}]+/giu,
        "$1[redacted]",
    );
    return redactHostingCredentials(redactedAuthorization)
        .replaceAll(/[\r\n]+/gu, " ")
        .slice(0, MAX_DIAGNOSTIC_LOG_LINE_CHARACTERS);
}

export function sanitizeDiagnosticLogField(
    value: string,
    maxCharacters: number,
): string {
    if (!Number.isSafeInteger(maxCharacters) || maxCharacters <= 0) {
        throw new Error(
            "Diagnostic log field limit must be a positive integer.",
        );
    }
    return sanitizeDiagnosticLogMessage(value).slice(0, maxCharacters);
}

export async function appendBoundedDiagnosticLog(
    logDirectory: string,
    message: string,
    maxBytes = MAX_DIAGNOSTIC_LOG_BYTES,
): Promise<void> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
        throw new Error(
            "Diagnostic log size limit must be a positive integer.",
        );
    }
    await mkdir(logDirectory, { recursive: true, mode: 0o700 });
    const logPath = join(logDirectory, LOG_FILE_NAME);
    const rotatedPath = join(logDirectory, ROTATED_LOG_FILE_NAME);
    const line = `${new Date().toISOString()} ${sanitizeDiagnosticLogMessage(message)}\n`;
    const lineBytes = Buffer.byteLength(line, "utf8");
    if (lineBytes > maxBytes) {
        throw new Error(
            "Diagnostic log entry exceeds the configured file limit.",
        );
    }

    let currentSize = 0;
    try {
        const metadata = await lstat(logPath);
        if (metadata.isSymbolicLink() || !metadata.isFile()) {
            throw new Error("Diagnostic log target must be a regular file.");
        }
        currentSize = metadata.size;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    if (currentSize + lineBytes > maxBytes) {
        await rm(rotatedPath, { force: true });
        if (currentSize <= maxBytes) await rename(logPath, rotatedPath);
        else await rm(logPath);
    }
    await appendFile(logPath, line, { encoding: "utf8", mode: 0o600 });
}
