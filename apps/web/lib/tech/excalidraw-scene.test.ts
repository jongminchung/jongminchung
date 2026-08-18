import { describe, expect, it } from "vitest";
import {
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

describe("구문 분석ExcalidrawSource", () => {
    it("[성공] 인증된 인정을 인정하고 인증 데이터를 준수함", () => {
        const scene = parseExcalidrawSource(
            createScene(),
            "fixture.excalidraw",
        );

        expect(scene).toMatchObject({
            type: "excalidraw",
            version: 2,
            elementCount: 1,
            textContent: ["kernel"],
        });
        expect(Object.isFrozen(scene)).toBe(true);
        expect(Object.isFrozen(scene.elements)).toBe(true);
    });

    it("[실패] 잘못된 JSON, 잘못된 존재 및 존재한 사건이 있었습니다", () => {
        expect(() => parseExcalidrawSource("{", "broken.excalidraw")).toThrow(
            /broken\.excalidraw: invalid JSON/u,
        );
        expect(() =>
            parseExcalidrawSource(JSON.stringify({ type: "other" })),
        ).toThrow(/field "type"/u);
        expect(() =>
            parseExcalidrawSource(createScene({ elements: [] })),
        ).toThrow(/non-empty array/u);
    });

    it("[실패] 불완전한 요소 ID 및 유효하지 않은 경계가 있음", () => {
        const duplicate = {
            id: "same",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 10,
            height: 10,
        };
        expect(() =>
            parseExcalidrawSource(
                createScene({ elements: [duplicate, duplicate] }),
            ),
        ).toThrow(/duplicate element ID "same"/u);
        expect(() =>
            parseExcalidrawSource(
                createScene({
                    elements: [{ ...duplicate, width: 0, height: 0 }],
                }),
            ),
        ).toThrow(/non-negative, non-empty bounds/u);
    });

    it("[실패] 바이너리 파일이 라벨링된 이미지 요소를 포함함", () => {
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

describe("Excalidraw 세트가 어떻게 되나요?", () => {
    it("[성공] 사업자 등록 파일 이름을 하나의 표시 URL에 매핑함", () => {
        expect(parseExcalidrawFilename("operating-system.excalidraw")).toEqual({
            filename: "operating-system.excalidraw",
            slug: "operating-system",
            src: "/diagrams/operating-system.excalidraw",
        });
        expect(
            parseExcalidrawAssetSrc("/diagrams/operating-system.excalidraw")
                .slug,
        ).toBe("operating-system");
    });

    it("[실패] 외부 및 상위 경로에 있음", () => {
        expect(() =>
            parseExcalidrawAssetSrc("https://example.com/diagram.excalidraw"),
        ).toThrow(/must use \/diagrams\//u);
        expect(() =>
            parseExcalidrawAssetSrc("/diagrams/../secret.excalidraw"),
        ).toThrow(/stay inside/u);
    });
});
