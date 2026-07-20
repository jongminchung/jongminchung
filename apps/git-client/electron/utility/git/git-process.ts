import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import {
  GIT_OUTPUT_LIMIT_BYTES,
  GIT_QUERY_TIMEOUT_MS,
  type GitFailureCode,
  type GitOutputStream,
} from "../../../src/shared/contracts/git-utility";
import { redactCredentialChunks, redactCredentials, safeErrorMessage } from "./redaction";

export type GitCancellationReason = "requested" | "repositoryClosed" | "timeout";

export interface GitProcessSpec {
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly stdin?: string;
  readonly redactStdout?: boolean;
  readonly timeoutMs?: number;
  readonly outputLimitBytes?: number;
  readonly editorEnvironment?: Readonly<{
    sequenceEditor: string;
    messageEditor: string;
  }>;
}

export interface GitProcessOutput {
  readonly stream: GitOutputStream;
  readonly data: string;
}

interface GitProcessOutcomeBase {
  readonly durationMs: number;
  readonly output: readonly GitProcessOutput[];
}

export interface GitProcessCompleted extends GitProcessOutcomeBase {
  readonly kind: "completed";
  readonly exitCode: number;
}

export interface GitProcessFailed extends GitProcessOutcomeBase {
  readonly kind: "failed";
  readonly code: GitFailureCode;
  readonly message: string;
  readonly exitCode: number | null;
}

export interface GitProcessCancelled extends GitProcessOutcomeBase {
  readonly kind: "cancelled";
  readonly reason: GitCancellationReason;
}

export type GitProcessOutcome = GitProcessCompleted | GitProcessFailed | GitProcessCancelled;

export interface GitProcessRunnerLike {
  run(spec: GitProcessSpec, signal?: AbortSignal): Promise<GitProcessOutcome>;
}

interface RawOutput {
  readonly stream: GitOutputStream;
  readonly data: Buffer;
}

interface DecodedOutput {
  readonly stream: GitOutputStream;
  data: string;
}

const PROCESS_ENVIRONMENT = Object.freeze({
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
  GIT_EDITOR: "true",
  GIT_MERGE_AUTOEDIT: "no",
});

function cancellationReason(signal: AbortSignal): GitCancellationReason {
  return signal.reason === "repositoryClosed" ? "repositoryClosed" : "requested";
}

function truncateUtf8(value: string, maximumBytes: number): string {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.byteLength <= maximumBytes) return value;
  let decoded = encoded.subarray(0, maximumBytes).toString("utf8");
  while (Buffer.byteLength(decoded, "utf8") > maximumBytes) decoded = decoded.slice(0, -1);
  return decoded;
}

function sanitizedOutput(
  chunks: readonly RawOutput[],
  outputLimitBytes: number,
  redactStdout: boolean,
): readonly GitProcessOutput[] {
  const decoders = new Map<GitOutputStream, StringDecoder>();
  const lastIndexes = new Map<GitOutputStream, number>();
  const decoded: DecodedOutput[] = [];
  for (const chunk of chunks) {
    const decoder = decoders.get(chunk.stream) ?? new StringDecoder("utf8");
    decoders.set(chunk.stream, decoder);
    decoded.push({ stream: chunk.stream, data: decoder.write(chunk.data) });
    lastIndexes.set(chunk.stream, decoded.length - 1);
  }
  for (const [stream, decoder] of decoders) {
    const tail = decoder.end();
    const lastIndex = lastIndexes.get(stream);
    if (tail.length > 0 && lastIndex !== undefined) decoded[lastIndex]!.data += tail;
  }

  const sanitized = decoded.map(({ data }) => data);
  for (const stream of ["stdout", "stderr"] as const) {
    if (stream === "stdout" && !redactStdout) continue;
    const indexes = decoded
      .map((entry, index) => (entry.stream === stream ? index : -1))
      .filter((index) => index >= 0);
    const redacted = redactCredentialChunks(indexes.map((index) => sanitized[index] ?? ""));
    indexes.forEach((index, streamIndex) => {
      sanitized[index] = redacted[streamIndex] ?? "";
    });
  }

  let remainingBytes = outputLimitBytes;
  const output: GitProcessOutput[] = [];
  for (const [index, entry] of decoded.entries()) {
    if (remainingBytes === 0) break;
    const data = truncateUtf8(sanitized[index] ?? "", remainingBytes);
    remainingBytes -= Buffer.byteLength(data, "utf8");
    output.push({ stream: entry.stream, data });
  }
  return output;
}

function signalProcessTree(
  child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals,
  ownsProcessGroup: boolean,
): void {
  if (ownsProcessGroup && child.pid !== undefined && child.pid > 1) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The group may already be gone or group signalling may be unavailable.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Process exit races are expected during cancellation.
  }
}

export class GitProcessRunner implements GitProcessRunnerLike {
  readonly #gitBinary: string;

  constructor(gitBinary = "git") {
    this.#gitBinary = gitBinary;
  }

  run(spec: GitProcessSpec, signal?: AbortSignal): Promise<GitProcessOutcome> {
    const startedAt = performance.now();
    const timeoutMs = spec.timeoutMs ?? GIT_QUERY_TIMEOUT_MS;
    const outputLimitBytes = spec.outputLimitBytes ?? GIT_OUTPUT_LIMIT_BYTES;
    const redactStdout = spec.redactStdout ?? true;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      return Promise.resolve(
        this.#invalidSpec(startedAt, "Git timeout must be a positive integer"),
      );
    }
    if (!Number.isSafeInteger(outputLimitBytes) || outputLimitBytes <= 0) {
      return Promise.resolve(
        this.#invalidSpec(startedAt, "Git output limit must be a positive integer"),
      );
    }
    if (signal?.aborted === true) {
      return Promise.resolve({
        kind: "cancelled",
        reason: cancellationReason(signal),
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        output: [],
      });
    }

    return new Promise((resolve) => {
      let child: ChildProcessWithoutNullStreams;
      const ownsProcessGroup = process.platform !== "win32";
      try {
        child = spawn(this.#gitBinary, [...spec.args], {
          cwd: spec.cwd,
          env: {
            ...process.env,
            ...PROCESS_ENVIRONMENT,
            ...(spec.editorEnvironment === undefined
              ? {}
              : {
                  GIT_SEQUENCE_EDITOR: spec.editorEnvironment.sequenceEditor,
                  GIT_EDITOR: spec.editorEnvironment.messageEditor,
                }),
          },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
          detached: ownsProcessGroup,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start Git";
        resolve({
          kind: "failed",
          code: "gitUnavailable",
          message: safeErrorMessage(message),
          exitCode: null,
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          output: [],
        });
        return;
      }

      const chunks: RawOutput[] = [];
      let outputBytes = 0;
      let stopReason: GitCancellationReason | "outputLimit" | null = null;
      let settled = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

      const durationMs = () => Math.max(0, Math.round(performance.now() - startedAt));
      const stop = (reason: GitCancellationReason | "outputLimit") => {
        if (stopReason !== null) return;
        stopReason = reason;
        if (child.exitCode === null && child.signalCode === null) {
          signalProcessTree(child, "SIGTERM", ownsProcessGroup);
          forceKillTimer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null)
              signalProcessTree(child, "SIGKILL", ownsProcessGroup);
          }, 2_000);
          forceKillTimer.unref();
        }
      };
      const append = (stream: GitOutputStream, value: Buffer) => {
        if (outputBytes >= outputLimitBytes) {
          stop("outputLimit");
          return;
        }
        const available = outputLimitBytes - outputBytes;
        const retained = value.byteLength <= available ? value : value.subarray(0, available);
        if (retained.byteLength > 0) chunks.push({ stream, data: Buffer.from(retained) });
        outputBytes += retained.byteLength;
        if (retained.byteLength < value.byteLength) stop("outputLimit");
      };
      const cleanUp = () => {
        clearTimeout(timeout);
        if (forceKillTimer !== null) clearTimeout(forceKillTimer);
        signal?.removeEventListener("abort", onAbort);
      };
      const finish = (outcome: GitProcessOutcome) => {
        if (settled) return;
        settled = true;
        cleanUp();
        resolve(outcome);
      };
      const onAbort = () => stop(signal === undefined ? "requested" : cancellationReason(signal));
      const timeout = setTimeout(() => stop("timeout"), timeoutMs);
      timeout.unref();
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted === true) onAbort();

      child.stdin.on("error", () => {
        // Git may reject an operation before consuming stdin; process close owns the result.
      });
      if (spec.stdin === undefined) child.stdin.end();
      else child.stdin.end(spec.stdin, "utf8");

      child.stdout.on("data", (value: Buffer) => append("stdout", value));
      child.stderr.on("data", (value: Buffer) => append("stderr", value));
      child.once("error", (error) => {
        const output = sanitizedOutput(chunks, outputLimitBytes, redactStdout);
        finish({
          kind: "failed",
          code: "gitUnavailable",
          message: safeErrorMessage(error.message),
          exitCode: null,
          durationMs: durationMs(),
          output,
        });
      });
      child.once("close", (exitCode) => {
        if (stopReason !== null && ownsProcessGroup) {
          signalProcessTree(child, "SIGKILL", ownsProcessGroup);
        }
        const output = sanitizedOutput(chunks, outputLimitBytes, redactStdout);
        if (stopReason === "outputLimit") {
          finish({
            kind: "failed",
            code: "outputLimit",
            message: `Git output exceeded ${outputLimitBytes} bytes`,
            exitCode,
            durationMs: durationMs(),
            output,
          });
          return;
        }
        if (
          stopReason === "requested" ||
          stopReason === "repositoryClosed" ||
          stopReason === "timeout"
        ) {
          finish({
            kind: "cancelled",
            reason: stopReason,
            durationMs: durationMs(),
            output,
          });
          return;
        }
        if (exitCode === 0) {
          finish({
            kind: "completed",
            exitCode,
            durationMs: durationMs(),
            output,
          });
          return;
        }
        const stderr = output
          .filter((entry) => entry.stream === "stderr")
          .map((entry) => entry.data)
          .join("");
        finish({
          kind: "failed",
          code: "commandFailed",
          message: safeErrorMessage(stderr || `Git exited with status ${exitCode ?? -1}`),
          exitCode,
          durationMs: durationMs(),
          output,
        });
      });
    });
  }

  #invalidSpec(startedAt: number, message: string): GitProcessFailed {
    return {
      kind: "failed",
      code: "invalidInput",
      message,
      exitCode: null,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      output: [],
    };
  }
}

export function displayGitCommand(args: readonly string[]): string {
  const rendered = args.map((value) => {
    const redacted = redactCredentials(value);
    return /^[A-Za-z0-9_./:=@+,-]+$/u.test(redacted) ? redacted : JSON.stringify(redacted);
  });
  return ["git", ...rendered].join(" ").slice(0, 2_048);
}
