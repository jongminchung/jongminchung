import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectToolWindow } from "./ProjectToolWindow";

describe("프로젝트도구창", () => {
    it("[성공] 리베이스된 프로젝트 도구 목록을 공유하고 함께", () => {
        const markup = renderToStaticMarkup(
            createElement(ProjectToolWindow, {
                activePath: "src/App.tsx",
                changes: [],
                hasCommits: true,
                loadTree: vi.fn().mockResolvedValue([]),
                onClose: vi.fn(),
                onNew: vi.fn(),
                onNewScratch: vi.fn(),
                onOpenFile: vi.fn(),
                onOpenScratch: vi.fn(),
                repositoryName: "reference",
                repositoryPath: "/private/tmp/reference",
                scratches: [],
                width: 386,
                onWidthChange: vi.fn(),
            }),
        );

        const actions = [
            "New File or Directory…",
            "Select Opened File (⌥F1, 1)",
            "Expand Selected",
            "Collapse All",
            "Options",
            "Hide",
        ];
        let previous = -1;
        for (const action of actions) {
            const index = markup.indexOf(`aria-label="${action}"`);
            expect(index).toBeGreaterThan(previous);
            previous = index;
        }

        expect(markup).toContain(
            'aria-label="reference  /private/tmp/reference" aria-expanded="true"',
        );
        const [selectOpenedFile] =
            markup.match(
                /<button[^>]*aria-label="Select Opened File \(⌥F1, 1\)"[^>]*>/,
            ) ?? [];
        expect(selectOpenedFile).toBeDefined();
        expect(selectOpenedFile).not.toContain('disabled=""');
    });

    it("[성공] 프로젝트에 활력 있는 편집기가 들어갈 수 있게 파일 선택을 시작함", () => {
        const markup = renderToStaticMarkup(
            createElement(ProjectToolWindow, {
                changes: [],
                hasCommits: true,
                loadTree: vi.fn().mockResolvedValue([]),
                onClose: vi.fn(),
                onNew: vi.fn(),
                onNewScratch: vi.fn(),
                onOpenFile: vi.fn(),
                onOpenScratch: vi.fn(),
                repositoryName: "dirty",
                repositoryPath: "/private/tmp/dirty",
                scratches: [],
                width: 458,
                onWidthChange: vi.fn(),
            }),
        );

        const [selectOpenedFile] =
            markup.match(
                /<button[^>]*aria-label="Select Opened File \(⌥F1, 1\)"[^>]*>/,
            ) ?? [];
        expect(selectOpenedFile).toBeDefined();
        expect(selectOpenedFile).toContain('disabled=""');
    });
});
