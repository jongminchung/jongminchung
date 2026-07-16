import { describe, expect, it } from "vitest";
import { orderedConsoleChunks } from "./console";

describe("Git Console stream ordering", () => {
  it("interleaves stdout and stderr by the backend sequence", () => {
    const chunks = orderedConsoleChunks([
      { sequence: 2, stream: "stdout", data: "third" },
      { sequence: 0, stream: "stdout", data: "first" },
      { sequence: 1, stream: "stderr", data: "second" },
    ]);
    expect(chunks.map((chunk) => `${chunk.stream}:${chunk.data}`)).toEqual([
      "stdout:first",
      "stderr:second",
      "stdout:third",
    ]);
  });
});
