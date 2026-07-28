import { describe, expect, it } from "vitest";
import {
  parseExcalidrawAssetSrc,
  parseExcalidrawFilename,
  parseExcalidrawSource,
} from "./excalidraw-scene";

function createScene(overrides: Readonly<Record<string, unknown>> = {}): string {
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

describe("parseExcalidrawSource", () => {
  it("normalizes a validated scene and exposes render verification data", () => {
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

  it("rejects invalid JSON, an invalid root, and an empty scene", () => {
    expect(() => parseExcalidrawSource("{", "broken.excalidraw")).toThrow(
      /broken\.excalidraw: invalid JSON/u,
    );
    expect(() => parseExcalidrawSource(JSON.stringify({ type: "other" }))).toThrow(/field "type"/u);
    expect(() => parseExcalidrawSource(createScene({ elements: [] }))).toThrow(/non-empty array/u);
  });

  it("rejects duplicate element IDs and invalid bounds", () => {
    const duplicate = {
      id: "same",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    expect(() => parseExcalidrawSource(createScene({ elements: [duplicate, duplicate] }))).toThrow(
      /duplicate element ID "same"/u,
    );
    expect(() =>
      parseExcalidrawSource(createScene({ elements: [{ ...duplicate, width: 0, height: 0 }] })),
    ).toThrow(/non-negative, non-empty bounds/u);
  });

  it("rejects image elements whose binary file is missing", () => {
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

describe("Excalidraw asset paths", () => {
  it("maps safe standalone filenames to one public URL", () => {
    expect(parseExcalidrawFilename("operating-system.excalidraw")).toEqual({
      filename: "operating-system.excalidraw",
      slug: "operating-system",
      src: "/diagrams/operating-system.excalidraw",
    });
    expect(parseExcalidrawAssetSrc("/diagrams/operating-system.excalidraw").slug).toBe(
      "operating-system",
    );
  });

  it("rejects external and parent path sources", () => {
    expect(() => parseExcalidrawAssetSrc("https://example.com/diagram.excalidraw")).toThrow(
      /must use \/diagrams\//u,
    );
    expect(() => parseExcalidrawAssetSrc("/diagrams/../secret.excalidraw")).toThrow(/stay inside/u);
  });
});
