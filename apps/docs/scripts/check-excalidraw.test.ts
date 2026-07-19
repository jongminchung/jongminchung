import { describe, expect, it } from "vitest";
import { findExcalidrawFences } from "./check-excalidraw";

describe("findExcalidrawFences", () => {
  it("finds Excalidraw JSON fences without consuming other code blocks", () => {
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
