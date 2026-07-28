import { describe, expect, it } from "vitest";
import { classifyMdxCodeBlock, codeLanguage, isExcalidrawCodeLanguage } from "./mdx-code";

describe("MDX code language routing", () => {
  it("routes Excalidraw fences to the diagram renderer", () => {
    expect(isExcalidrawCodeLanguage(codeLanguage("language-excalidraw"))).toBe(true);
    expect(isExcalidrawCodeLanguage(codeLanguage("language-EXCALIDRAW"))).toBe(true);
    expect(classifyMdxCodeBlock("language-excalidraw", '{"type":"excalidraw"}\n')).toEqual({
      kind: "excalidraw",
      source: '{"type":"excalidraw"}',
    });
  });

  it("keeps ordinary and unlabelled fences on the code renderer", () => {
    expect(isExcalidrawCodeLanguage(codeLanguage("language-typescript"))).toBe(false);
    expect(codeLanguage(undefined)).toBe("text");
    expect(classifyMdxCodeBlock("language-typescript", "const ready = true;\n")).toEqual({
      kind: "code",
      language: "typescript",
      source: "const ready = true;",
    });
  });
});
