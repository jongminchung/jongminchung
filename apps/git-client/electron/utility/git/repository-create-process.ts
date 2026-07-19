import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import type {
  GitCancellationReason,
  GitProcessOutcome,
  GitProcessOutput,
  GitProcessSpec,
} from "./git-process";
import { redactCredentials, safeErrorMessage } from "./redaction";

export type RepositoryCreateOutputListener = (output: GitProcessOutput) => void;

export interface RepositoryCreateProcessRunnerLike {
  run(
    spec: GitProcessSpec,
    onOutput: RepositoryCreateOutputListener,
    signal?: AbortSignal,
  ): Promise<GitProcessOutcome>;
}

interface StreamState {
  readonly decoder: StringDecoder;
  buffer: string;
}

const PROCESS_ENVIRONMENT = Object.freeze({
  GIT_ALLOW_PROTOCOL: "file:git:http:https:ssh",
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  LC_ALL: "C",
});

function cancellationReason(signal: AbortSignal): GitCancellationReason {
  return signal.reason === "timeout" ? "timeout" : "requested";
}

function stderrText(output: readonly GitProcessOutput[]): string {
  return output
    .filter((entry) => entry.stream === "stderr")
    .map((entry) => entry.data)
    .join("");
}

export class RepositoryCreateProcessRunner implements RepositoryCreateProcessRunnerLike {
  readonly #gitBinary: string;

  private constructor(gitBinary: string) {
    this.#gitBinary = gitBinary;
  }

  static create(): RepositoryCreateProcessRunner {
    return new RepositoryCreateProcessRunner("git");
  }

  static ofGitBinary(gitBinary: string): RepositoryCreateProcessRunner {
    return new RepositoryCreateProcessRunner(gitBinary);
  }

  run(
    spec: GitProcessSpec,
    onOutput: RepositoryCreateOutputListener,
    signal?: AbortSignal,
  ): Promise<GitProcessOutcome> {
    const startedAt = performance.now();
    const timeoutMs = spec.timeoutMs ?? 120_000;
    const outputLimitBytes = spec.outputLimitBytes ?? 16 * 1024 * 1024;
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

    return new Promise((resolveOutcome) => {
      let child: ChildProcessByStdio<null, Readable, Readable>;
      try {
        child = spawn(this.#gitBinary, [...spec.args], {
          cwd: spec.cwd,
          env: { ...process.env, ...PROCESS_ENVIRONMENT },
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start Git";
        resolveOutcome({
          kind: "failed",
          code: "gitUnavailable",
          message: safeErrorMessage(message),
          exitCode: null,
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          output: [],
        });
        return;
      }

      const output: GitProcessOutput[] = [];
      const streams = {
        stdout: { decoder: new StringDecoder("utf8"), buffer: "" },
        stderr: { decoder: new StringDecoder("utf8"), buffer: "" },
      } satisfies Record<"stdout" | "stderr", StreamState>;
      let outputBytes = 0;
      let stopReason: GitCancellationReason | "outputLimit" | null = null;
      let settled = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

      const durationMs = (): number => Math.max(0, Math.round(performance.now() - startedAt));
      const emit = (stream: "stdout" | "stderr", data: string): void => {
        if (data.length === 0) return;
        const entry = Object.freeze({ stream, data: redactCredentials(data) });
        output.push(entry);
        try {
          onOutput(entry);
        } catch {
          // A renderer listener must not interfere with process cleanup.
        }
      };
      const emitCompleteLines = (stream: "stdout" | "stderr"): void => {
        const state = streams[stream];
        while (state.buffer.length > 0) {
          const match = /[\r\n]/u.exec(state.buffer);
          if (match === null) return;
          const delimiterIndex = match.index;
          const hasCrLf =
            state.buffer[delimiterIndex] === "\r" && state.buffer[delimiterIndex + 1] === "\n";
          const end = delimiterIndex + (hasCrLf ? 2 : 1);
          emit(stream, state.buffer.slice(0, end));
          state.buffer = state.buffer.slice(end);
        }
      };
      const append = (stream: "stdout" | "stderr", value: Buffer): void => {
        if (outputBytes >= outputLimitBytes) {
          stop("outputLimit");
          return;
        }
        const available = outputLimitBytes - outputBytes;
        const retained = value.byteLength <= available ? value : value.subarray(0, available);
        outputBytes += retained.byteLength;
        streams[stream].buffer += streams[stream].decoder.write(retained);
        emitCompleteLines(stream);
        if (retained.byteLength < value.byteLength) stop("outputLimit");
      };
      const flush = (stream: "stdout" | "stderr"): void => {
        const state = streams[stream];
        state.buffer += state.decoder.end();
        emitCompleteLines(stream);
        if (state.buffer.length > 0) emit(stream, state.buffer);
        state.buffer = "";
      };
      const stop = (reason: GitCancellationReason | "outputLimit"): void => {
        if (stopReason !== null) return;
        stopReason = reason;
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");
          forceKillTimer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
          }, 2_000);
          forceKillTimer.unref();
        }
      };
      const cleanUp = (): void => {
        clearTimeout(timeout);
        if (forceKillTimer !== null) clearTimeout(forceKillTimer);
        signal?.removeEventListener("abort", onAbort);
      };
      const finish = (outcome: GitProcessOutcome): void => {
        if (settled) return;
        settled = true;
        cleanUp();
        resolveOutcome(outcome);
      };
      const onAbort = (): void =>
        stop(signal === undefined ? "requested" : cancellationReason(signal));
      const timeout = setTimeout(() => stop("timeout"), timeoutMs);
      timeout.unref();
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted === true) onAbort();

      child.stdout.on("data", (value: Buffer) => append("stdout", value));
      child.stderr.on("data", (value: Buffer) => append("stderr", value));
      child.once("error", (error) => {
        flush("stdout");
        flush("stderr");
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
        flush("stdout");
        flush("stderr");
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
          finish({ kind: "cancelled", reason: stopReason, durationMs: durationMs(), output });
          return;
        }
        if (exitCode === 0) {
          finish({ kind: "completed", exitCode, durationMs: durationMs(), output });
          return;
        }
        finish({
          kind: "failed",
          code: "commandFailed",
          message: safeErrorMessage(
            stderrText(output) || `Git exited with status ${exitCode ?? -1}`,
          ),
          exitCode,
          durationMs: durationMs(),
          output,
        });
      });
    });
  }

  #invalidSpec(startedAt: number, message: string): GitProcessOutcome {
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
