import { describe, expect, it } from "bun:test";
import {
  excalidrawSceneId,
  excalidrawSvgSrc,
  parseExcalidrawAssetSrc,
  parseExcalidrawFilename,
  parseExcalidrawSource,
} from "./excalidraw-scene";

function createScene(
  overrides: Readonly<Record<string, unknown>> = {},
): string {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: [
      {
        id: "text-1",
        type: "text",
        x: 10,
        y: 20,
        width: 100,
        height: 24,
        text: "kernel",
        isDeleted: false,
      },
    ],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
    ...overrides,
  });
}

describe("Excalidraw source 파싱", () => {
  it("[성공] 유효한 scene을 파싱하고 결과와 요소 배열을 동결함", () => {
    const scene = parseExcalidrawSource(createScene(), "fixture.excalidraw");

    expect(scene).toMatchObject({
      type: "excalidraw",
      version: 2,
      elementCount: 1,
      textContent: ["kernel"],
    });
    expect(Object.isFrozen(scene)).toBe(true);
    expect(Object.isFrozen(scene.elements)).toBe(true);
  });

  it("[실패] 잘못된 JSON·scene 유형·빈 요소 배열을 거부함", () => {
    expect(() => parseExcalidrawSource("{", "broken.excalidraw")).toThrow(
      /broken\.excalidraw: invalid JSON/u,
    );
    expect(() =>
      parseExcalidrawSource(JSON.stringify({ type: "other" })),
    ).toThrow(/field "type"/u);
    expect(() => parseExcalidrawSource(createScene({ elements: [] }))).toThrow(
      /non-empty array/u,
    );
  });

  it("[실패] 중복 요소 ID와 비어 있는 경계를 거부함", () => {
    const duplicate = {
      id: "same",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    expect(() =>
      parseExcalidrawSource(createScene({ elements: [duplicate, duplicate] })),
    ).toThrow(/duplicate element ID "same"/u);
    expect(() =>
      parseExcalidrawSource(
        createScene({
          elements: [{ ...duplicate, width: 0, height: 0 }],
        }),
      ),
    ).toThrow(/non-negative, non-empty bounds/u);
  });

  it("[실패] 존재하지 않는 바이너리 파일을 참조하는 이미지를 거부함", () => {
    expect(() =>
      parseExcalidrawSource(
        createScene({
          elements: [
            {
              id: "image-1",
              type: "image",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              fileId: "missing-file",
            },
          ],
        }),
      ),
    ).toThrow(/references missing file "missing-file"/u);
  });
});

describe("Excalidraw asset 경로", () => {
  it("[성공] 파일 이름을 slug와 공개 diagram URL로 변환함", () => {
    expect(parseExcalidrawFilename("operating-system.excalidraw")).toEqual({
      filename: "operating-system.excalidraw",
      slug: "operating-system",
      src: "/diagrams/operating-system.excalidraw",
    });
    expect(
      parseExcalidrawAssetSrc("/diagrams/operating-system.excalidraw").slug,
    ).toBe("operating-system");
  });

  it("[실패] 외부 URL과 상위 디렉터리 접근을 거부함", () => {
    expect(() =>
      parseExcalidrawAssetSrc("https://example.com/diagram.excalidraw"),
    ).toThrow(/must use \/diagrams\//u);
    expect(() =>
      parseExcalidrawAssetSrc("/diagrams/../secret.excalidraw"),
    ).toThrow(/stay inside/u);
  });
});

describe("정적 Excalidraw SVG 경로", () => {
  it("원본 문자열에서 테마별 생성 SVG 경로를 결정적으로 계산함", () => {
    const source = createScene();
    const id = excalidrawSceneId(source);

    expect(id).toMatch(/^[0-9a-f]{8}$/u);
    expect(excalidrawSvgSrc(source, "light")).toBe(
      `/excalidraw-assets/diagrams/${id}.light.svg`,
    );
    expect(excalidrawSvgSrc(source, "dark")).toBe(
      `/excalidraw-assets/diagrams/${id}.dark.svg`,
    );
  });
});
