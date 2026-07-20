import { describe, expect, it } from "vitest";
import type { GitEvent, RequestId } from "../shared/contracts/model";
import { GitRequestEventBuffer } from "./gitRequestEvents";

const requestId = "request-1" as RequestId;

function event(value: GitEvent): GitEvent {
  return value;
}

describe("GitRequestEventBuffer", () => {
  it("collects ordered parser input and clears it on completion", () => {
    const buffer = new GitRequestEventBuffer();
    expect(
      buffer.consume(
        event({ kind: "started", requestId, displayCommand: "hidden", startedAtMs: 1 }),
      ),
    ).toEqual({ kind: "started", requestId });
    buffer.consume(
      event({ kind: "output", requestId, sequence: 0, stream: "stdout", data: "first" }),
    );
    buffer.consume(
      event({ kind: "output", requestId, sequence: 1, stream: "stderr", data: " second" }),
    );
    expect(
      buffer.consume(event({ kind: "completed", requestId, exitCode: 0, durationMs: 3 })),
    ).toEqual({ kind: "completed", requestId, output: "first second" });
    expect(buffer.retainedChunkCount).toBe(0);
  });

  it.each([
    event({ kind: "failed", requestId, message: "fatal", exitCode: 1, durationMs: 4 }),
    event({ kind: "cancelled", requestId, durationMs: 5 }),
  ])("clears parser input for $kind", (terminalEvent) => {
    const buffer = new GitRequestEventBuffer();
    buffer.consume(
      event({ kind: "output", requestId, sequence: 0, stream: "stdout", data: "secret output" }),
    );
    expect(buffer.consume(terminalEvent).kind).toBe(terminalEvent.kind);
    expect(buffer.retainedChunkCount).toBe(0);
  });
});
