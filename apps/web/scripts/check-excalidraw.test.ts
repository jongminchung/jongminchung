import { describe, expect, it } from "vitest";
import { findExcalidrawFences } from "./check-excalidraw";

describe("findExcalidraw울타리", () => {
    it("[실패] 다른 코드 블록을 사용하지 않고 Excalidraw JSON을 찾고 있음", () => {
        const markdown = [
            "```typescript",
            "const value = true;",
            "```",
            "",
            "```excalidraw",
            '{"type":"excalidraw"}',
            "```",
        ].join("\n");

        expect(findExcalidrawFences(markdown)).toEqual([
            { index: 0, source: '{"type":"excalidraw"}\n' },
        ]);
    });
});
