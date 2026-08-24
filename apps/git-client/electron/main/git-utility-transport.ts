import type { UtilityProcess } from "electron";
import type { GitUtilityProtocolErrorCode } from "../../src/shared/contracts/git-utility-process";

export type GitUtilityTransportErrorCode =
  | GitUtilityProtocolErrorCode
  | "protocolViolation"
  | "utilityExited"
  | "utilityFatalError"
  | "handshakeTimeout"
  | "disposed";

export class GitUtilityTransportError extends Error {
  readonly code: GitUtilityTransportErrorCode;

  constructor(code: GitUtilityTransportErrorCode, message: string) {
    super(message);
    this.name = "GitUtilityTransportError";
    this.code = code;
  }
}

export interface GitUtilityProcessTransport {
  postMessage(message: unknown): void;
  subscribeMessage(listener: (message: unknown) => void): () => void;
  subscribeExit(listener: (exitCode: number) => void): () => void;
  subscribeError(listener: (message: string) => void): () => void;
  kill(): boolean;
}

export interface GitUtilityClientConnectOptions {
  readonly handshakeTimeoutMs?: number;
  readonly onCrash?: (error: Error) => void;
}

export interface GitUtilityClientForkOptions extends GitUtilityClientConnectOptions {
  readonly storageRoot: string;
}

export function createElectronTransport(
  child: UtilityProcess,
): GitUtilityProcessTransport {
  return {
    postMessage: (message) => child.postMessage(message),
    subscribeMessage: (listener) => {
      const receive = (message: unknown) => listener(message);
      child.on("message", receive);
      return () => child.off("message", receive);
    },
    subscribeExit: (listener) => {
      child.on("exit", listener);
      return () => child.off("exit", listener);
    },
    subscribeError: (listener) => {
      const receive = (type: "FatalError", location: string) =>
        listener(`${type} at ${location}`);
      child.on("error", receive);
      return () => child.off("error", receive);
    },
    kill: () => child.kill(),
  };
}
