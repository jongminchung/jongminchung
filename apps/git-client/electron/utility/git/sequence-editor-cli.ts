import { isAbsolute, resolve } from "node:path";
import { safeErrorMessage } from "./redaction";
import {
  SequenceEditorError,
  SequenceEditorSession,
  applySequenceEditor,
  type SequenceEditorMode,
} from "./sequence-editor";

export interface SequenceEditorCliOptions {
  readonly signal?: AbortSignal;
  readonly writeError?: (text: string) => void;
}

export interface SequenceEditorCommandRequest {
  readonly executablePath: string;
  readonly entryPath: string;
  readonly mode: SequenceEditorMode;
  readonly session: SequenceEditorSession;
}

export interface ApplicationSequenceEditorCommandRequest {
  readonly executablePath: string;
  readonly applicationEntryPath: string | null;
  readonly mode: SequenceEditorMode;
  readonly session: SequenceEditorSession;
}

export const SEQUENCE_EDITOR_APPLICATION_ARGUMENT = "--git-client-sequence-editor";

function normalizedAbsolutePath(value: string, field: string): string {
  if (
    value.length === 0 ||
    value.length > 16_384 ||
    value.includes("\0") ||
    !isAbsolute(value) ||
    resolve(value) !== value
  ) {
    throw new SequenceEditorError("invalidInput", `${field} must be a normalized absolute path`);
  }
  return value;
}

function quotePosixArgument(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function createSequenceEditorCommand(request: SequenceEditorCommandRequest): string {
  if (
    !(request.session instanceof SequenceEditorSession) ||
    !/^[0-9a-f]{64}$/u.test(request.session.nonce)
  ) {
    throw new SequenceEditorError("authenticationFailed", "Sequence editor authentication failed");
  }
  const mode =
    request.mode === "sequence"
      ? "--sequence-editor"
      : request.mode === "message"
        ? "--message-editor"
        : null;
  if (mode === null) {
    throw new SequenceEditorError("invalidInput", "Invalid sequence editor mode");
  }
  return [
    normalizedAbsolutePath(request.executablePath, "Executable path"),
    normalizedAbsolutePath(request.entryPath, "Entry path"),
    mode,
    "--payload",
    normalizedAbsolutePath(request.session.payloadPath, "Payload path"),
    "--nonce",
    request.session.nonce,
  ]
    .map(quotePosixArgument)
    .join(" ");
}

export function createApplicationSequenceEditorCommand(
  request: ApplicationSequenceEditorCommandRequest,
): string {
  if (
    !(request.session instanceof SequenceEditorSession) ||
    !/^[0-9a-f]{64}$/u.test(request.session.nonce)
  ) {
    throw new SequenceEditorError("authenticationFailed", "Sequence editor authentication failed");
  }
  const mode =
    request.mode === "sequence"
      ? "--sequence-editor"
      : request.mode === "message"
        ? "--message-editor"
        : null;
  if (mode === null) throw new SequenceEditorError("invalidInput", "Invalid sequence editor mode");
  const arguments_ = [normalizedAbsolutePath(request.executablePath, "Executable path")];
  if (request.applicationEntryPath !== null) {
    arguments_.push(normalizedAbsolutePath(request.applicationEntryPath, "Application entry path"));
  }
  arguments_.push(
    SEQUENCE_EDITOR_APPLICATION_ARGUMENT,
    mode,
    "--payload",
    normalizedAbsolutePath(request.session.payloadPath, "Payload path"),
    "--nonce",
    request.session.nonce,
  );
  return arguments_.map(quotePosixArgument).join(" ");
}

function parseMode(value: string | undefined): SequenceEditorMode {
  if (value === "--sequence-editor") return "sequence";
  if (value === "--message-editor") return "message";
  throw new SequenceEditorError("invalidInput", "Expected --sequence-editor or --message-editor");
}

function parseArguments(arguments_: readonly string[]): {
  readonly mode: SequenceEditorMode;
  readonly payloadPath: string;
  readonly nonce: string;
  readonly targetPath: string;
} {
  if (arguments_.length !== 6 || arguments_[1] !== "--payload" || arguments_[3] !== "--nonce") {
    throw new SequenceEditorError("invalidInput", "Invalid sequence editor arguments");
  }
  const payloadPath = arguments_[2];
  const nonce = arguments_[4];
  const targetPath = arguments_[5];
  if (payloadPath === undefined || nonce === undefined || targetPath === undefined) {
    throw new SequenceEditorError("invalidInput", "Invalid sequence editor arguments");
  }
  return {
    mode: parseMode(arguments_[0]),
    payloadPath,
    nonce,
    targetPath,
  };
}

function publicError(error: unknown, nonce: string | undefined): string {
  const message = safeErrorMessage(
    error instanceof Error ? error.message : "Sequence editor failed",
  );
  if (nonce === undefined || !/^[0-9a-f]{64}$/u.test(nonce)) return message;
  return message.replaceAll(nonce, "[redacted]").replaceAll(nonce.toUpperCase(), "[redacted]");
}

export async function runSequenceEditorCli(
  arguments_: readonly string[],
  options: SequenceEditorCliOptions = {},
): Promise<number> {
  try {
    const request = parseArguments(arguments_);
    await applySequenceEditor({ ...request, signal: options.signal });
    return 0;
  } catch (error) {
    const writeError =
      options.writeError ??
      ((text: string): void => {
        process.stderr.write(text);
      });
    writeError(`Git Client sequence editor: ${publicError(error, arguments_[4])}\n`);
    return 2;
  }
}
