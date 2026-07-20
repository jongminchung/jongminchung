import type { OutputStream } from "./OutputStream";
import type { RequestId } from "./RequestId";

export type GitEvent =
  | { kind: "started"; requestId: RequestId; displayCommand: string; startedAtMs: number }
  | { kind: "output"; requestId: RequestId; sequence: number; stream: OutputStream; data: string }
  | { kind: "completed"; requestId: RequestId; exitCode: number; durationMs: number }
  | {
      kind: "failed";
      requestId: RequestId;
      message: string;
      exitCode: number | null;
      durationMs: number;
    }
  | { kind: "cancelled"; requestId: RequestId; durationMs: number };
