import { describe, expect, it } from "vitest";
import { parseConflictBlocks, resolveConflictBlock } from "./conflicts";

describe("conflict blocks", () => {
  it("resolves one marker block while preserving surrounding text", () => {
    const result = "before\n<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> side\nafter\n";
    const [block] = parseConflictBlocks(result);
    expect(block).toMatchObject({ local: "local", remote: "remote" });
    expect(resolveConflictBlock(result, block!, "both")).toBe("before\nlocal\nremote\nafter\n");
  });
});
