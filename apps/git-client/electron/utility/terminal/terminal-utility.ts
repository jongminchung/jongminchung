import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import {
  TERMINAL_OUTPUT_CHUNK_BYTES,
  TerminalCloseRepositoryRequestSchema,
  TerminalCloseRequestSchema,
  TerminalCreateResultSchema,
  TerminalEventEnvelopeSchema,
  TerminalLaunchTargetsSchema,
  TerminalResizeRequestSchema,
  TerminalWriteRequestSchema,
  type TerminalCreateResult,
  type TerminalEventEnvelope,
  type TerminalLaunchTargets,
} from "../../../src/shared/contracts/terminal";
import {
  TerminalUtilityCreateSpecSchema,
  type TerminalUtilityErrorCode,
} from "../../../src/shared/contracts/terminal-utility-process";
import type {
  ResolvedTerminalLaunchTarget,
  TerminalLaunchTargetResolverPort,
} from "./terminal-launch-target-resolver";

type TerminalUtilityServiceErrorCode = Extract<
  TerminalUtilityErrorCode,
  "invalidRequest" | "sessionNotFound" | "spawnFailed"
>;

export class TerminalUtilityError extends Error {
  readonly code: TerminalUtilityServiceErrorCode;

  constructor(code: TerminalUtilityServiceErrorCode, message: string) {
    super(message);
    this.name = "TerminalUtilityError";
    this.code = code;
  }
}

export interface PtyProcessExit {
  readonly exitCode: number;
  readonly signal: number | string | null;
}

export interface PtySpawnOptions {
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
  readonly env: Readonly<Record<string, string>>;
  readonly name: string;
}

export interface PtyProcess {
  onData(listener: (data: string) => void): () => void;
  onExit(listener: (event: PtyProcessExit) => void): () => void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

export interface PtySpawner {
  spawn(shell: string, args: readonly string[], options: PtySpawnOptions): PtyProcess;
}

export interface TerminalUtilityOptions {
  readonly shell: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly launchTargetResolver?: TerminalLaunchTargetResolverPort;
}

type TerminalEventListener = (event: TerminalEventEnvelope) => void;

interface TerminalSession {
  readonly requestId: string;
  readonly repositoryId: string;
  readonly process: PtyProcess;
  readonly listener: TerminalEventListener;
  readonly unsubscribe: readonly [() => void, () => void];
  nextSequence: number;
}

export class TerminalUtility {
  readonly #spawner: PtySpawner;
  readonly #options: TerminalUtilityOptions;
  readonly #sessions = new Map<string, TerminalSession>();

  private constructor(spawner: PtySpawner, options: TerminalUtilityOptions) {
    if (!isAbsolute(options.shell) || options.shell.includes("\0")) {
      throw new Error("Terminal shell must be an absolute path");
    }
    this.#spawner = spawner;
    this.#options = options;
  }

  static of(spawner: PtySpawner, options: TerminalUtilityOptions): TerminalUtility {
    return new TerminalUtility(spawner, options);
  }

  create(untrustedRequest: unknown, listener: TerminalEventListener): TerminalCreateResult {
    const request = TerminalUtilityCreateSpecSchema.parse(untrustedRequest);
    if (!isAbsolute(request.cwd)) throw new Error("Terminal cwd must be an absolute path");
    const launchTarget = this.#resolveLaunchTarget(request.target);
    const terminalId = randomUUID();
    let process: PtyProcess;
    try {
      process = this.#spawner.spawn(launchTarget.executable, launchTarget.args, {
        cwd: request.cwd,
        cols: request.cols,
        rows: request.rows,
        env: {
          ...this.#options.environment,
          COLORTERM: "truecolor",
          TERM: "xterm-256color",
          TERM_PROGRAM: "GitClient",
        },
        name: "xterm-256color",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown PTY error";
      throw new TerminalUtilityError("spawnFailed", `Unable to start terminal shell: ${detail}`);
    }
    const dataSubscription = process.onData((data) => {
      this.#output(terminalId, data);
    });
    const exitSubscription = process.onExit((event) => {
      this.#exit(terminalId, event);
    });
    this.#sessions.set(terminalId, {
      requestId: request.requestId,
      repositoryId: request.repositoryId,
      process,
      listener,
      unsubscribe: [dataSubscription, exitSubscription],
      nextSequence: 0,
    });
    return TerminalCreateResultSchema.parse({
      requestId: request.requestId,
      terminalId,
    });
  }

  listLaunchTargets(): TerminalLaunchTargets {
    return TerminalLaunchTargetsSchema.parse(
      this.#options.launchTargetResolver?.listTargets() ?? {
        shells: [],
        agents: [],
      },
    );
  }

  write(untrustedRequest: unknown): void {
    const request = TerminalWriteRequestSchema.parse(untrustedRequest);
    this.#session(request.terminalId).process.write(request.data);
  }

  resize(untrustedRequest: unknown): void {
    const request = TerminalResizeRequestSchema.parse(untrustedRequest);
    this.#session(request.terminalId).process.resize(request.cols, request.rows);
  }

  close(untrustedRequest: unknown): void {
    const request = TerminalCloseRequestSchema.parse(untrustedRequest);
    this.#close(request.terminalId);
  }

  closeRepository(untrustedRequest: unknown): number {
    const request = TerminalCloseRepositoryRequestSchema.parse(untrustedRequest);
    const terminalIds = [...this.#sessions.entries()]
      .filter(([, session]) => session.repositoryId === request.repositoryId)
      .map(([terminalId]) => terminalId);
    for (const terminalId of terminalIds) this.#close(terminalId);
    return terminalIds.length;
  }

  dispose(): void {
    for (const terminalId of this.#sessions.keys()) this.#close(terminalId);
  }

  get sessionCount(): number {
    return this.#sessions.size;
  }

  #output(terminalId: string, data: string): void {
    const session = this.#sessions.get(terminalId);
    if (session === undefined) return;
    const encoded = new TextEncoder().encode(data);
    for (let offset = 0; offset < encoded.length; offset += TERMINAL_OUTPUT_CHUNK_BYTES) {
      const event = TerminalEventEnvelopeSchema.parse({
        kind: "output",
        requestId: session.requestId,
        terminalId,
        sequence: session.nextSequence,
        data: Array.from(encoded.subarray(offset, offset + TERMINAL_OUTPUT_CHUNK_BYTES)),
      });
      session.nextSequence += 1;
      this.#deliver(session.listener, event);
    }
  }

  #exit(terminalId: string, exit: PtyProcessExit): void {
    const session = this.#sessions.get(terminalId);
    if (session === undefined) return;
    this.#sessions.delete(terminalId);
    for (const unsubscribe of session.unsubscribe) unsubscribe();
    const signal = exit.signal === null || exit.signal === 0 ? null : String(exit.signal);
    this.#deliver(
      session.listener,
      TerminalEventEnvelopeSchema.parse({
        kind: "exited",
        requestId: session.requestId,
        terminalId,
        exitCode: exit.exitCode,
        signal,
      }),
    );
  }

  #close(terminalId: string): void {
    const session = this.#sessions.get(terminalId);
    if (session === undefined) return;
    this.#sessions.delete(terminalId);
    for (const unsubscribe of session.unsubscribe) unsubscribe();
    session.process.kill();
  }

  #session(terminalId: string): TerminalSession {
    const session = this.#sessions.get(terminalId);
    if (session === undefined) {
      throw new TerminalUtilityError("sessionNotFound", "Terminal session does not exist");
    }
    return session;
  }

  #resolveLaunchTarget(
    target: Parameters<NonNullable<TerminalUtilityOptions["launchTargetResolver"]>["resolve"]>[0],
  ): ResolvedTerminalLaunchTarget {
    if (target.kind === "default") {
      return (
        this.#options.launchTargetResolver?.resolve(target) ?? {
          executable: this.#options.shell,
          args: [],
          title: "Local",
        }
      );
    }
    const resolved = this.#options.launchTargetResolver?.resolve(target) ?? null;
    if (resolved !== null) return resolved;
    throw new TerminalUtilityError(
      "invalidRequest",
      "Requested terminal launch target is unavailable",
    );
  }

  #deliver(listener: TerminalEventListener, event: TerminalEventEnvelope): void {
    try {
      listener(event);
    } catch {
      // A consumer callback cannot compromise PTY process cleanup or later output.
    }
  }
}
