import { describe, expect, it } from "vitest";
import { parseConflictBlocks, resolveConflictBlock } from "./conflicts";

describe("블록 충돌", () => {
    it("[실패] 파이어베이스를 유지하면서 하나의 표식기 블록을 해결함", () => {
        const result =
            "before\n<<<<<<< HEAD\nlocal\n=======\nremote\n>>>>>>> side\nafter\n";
        const [block] = parseConflictBlocks(result);
        expect(block).toMatchObject({ local: "local", remote: "remote" });
        expect(resolveConflictBlock(result, block!, "both")).toBe(
            "before\nlocal\nremote\nafter\n",
        );
    });
});
