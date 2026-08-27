import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  classifyMdxCodeBlock,
  codeLanguage,
  isExcalidrawCodeLanguage,
} from "./mdx-code";

describe("MDX 코드 종류", () => {
  it("[성공] Excalidraw 본체를 장착 렌더러로함", () => {
    expect(isExcalidrawCodeLanguage(codeLanguage("language-excalidraw"))).toBe(
      true,
    );
    expect(isExcalidrawCodeLanguage(codeLanguage("language-EXCALIDRAW"))).toBe(
      true,
    );
    expect(
      classifyMdxCodeBlock("language-excalidraw", '{"type":"excalidraw"}\n'),
    ).toEqual({
      kind: "excalidraw",
      source: '{"type":"excalidraw"}',
    });
  });

  it("[성공] 코드 렌더러에 월하고 라벨이 없는 펜스를 유지함", () => {
    expect(isExcalidrawCodeLanguage(codeLanguage("language-typescript"))).toBe(
      false,
    );
    expect(codeLanguage(undefined)).toBe("text");
    expect(
      classifyMdxCodeBlock("language-typescript", "const ready = true;\n"),
    ).toEqual({
      kind: "code",
      language: "typescript",
      source: "const ready = true;",
    });
  });

  it("[성공] Shiki가 중첩한 React 노드에서 원본 문자열을 복원함", () => {
    const highlighted = createElement(
      "span",
      { className: "line" },
      createElement("span", null, '{"type":'),
      createElement("span", null, '"excalidraw"}'),
    );
    expect(
      classifyMdxCodeBlock(
        "shiki language-excalidraw",
        createElement("span", null, highlighted),
      ),
    ).toEqual({ kind: "excalidraw", source: '{"type":"excalidraw"}' });
  });
});
