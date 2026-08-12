import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WelcomeWorkspace } from "./WelcomeWorkspace";

describe("WelcomeWorkspace", () => {
    it("matches the Rebased welcome project actions and category structure", () => {
        const markup = renderToStaticMarkup(
            createElement(WelcomeWorkspace, {
                appearancePreference: { theme: "dark", syncWithOs: false },
                onAppearancePreferenceChange: vi.fn(),
                onCloneRepository: vi.fn(),
                onNewProject: vi.fn(),
                onOpenRecent: vi.fn(),
                onOpenRepository: vi.fn(),
                onOpenSettings: vi.fn(),
                recentProjects: [],
            }),
        );

        expect(markup).toContain('aria-label="Welcome screen categories"');
        expect(markup).toContain(
            'style="grid-template-columns:224px minmax(0, 1fr)"',
        );
        expect(markup).toContain('style="width:224px"');
        expect(markup).toContain('style="width:200px;height:32px"');
        expect(markup).toContain("Welcome to Git Client");
        expect(markup).toContain(
            "Open existing project from disk or version control.",
        );
        expect(markup).not.toContain(
            "Open an existing project from disk or version control.",
        );
        expect(markup).toContain("New Project");
        expect(markup).toContain("Open");
        expect(markup).toContain("Clone Repository");
        expect(markup).toContain("Customize");
        expect(markup).not.toContain("Plugins");

        const labels = [
            "Projects",
            "Customize",
            "New Project",
            "Open",
            "Clone Repository",
        ];
        let previous = -1;
        for (const label of labels) {
            const index = markup.indexOf(`>${label}<`);
            expect(index).toBeGreaterThan(previous);
            previous = index;
        }
    });

    it("renders persisted recent projects as actionable rows", () => {
        const markup = renderToStaticMarkup(
            createElement(WelcomeWorkspace, {
                appearancePreference: { theme: "dark", syncWithOs: false },
                onAppearancePreferenceChange: vi.fn(),
                onCloneRepository: vi.fn(),
                onNewProject: vi.fn(),
                onOpenRecent: vi.fn(),
                onOpenRepository: vi.fn(),
                onOpenSettings: vi.fn(),
                recentProjects: [
                    {
                        branch: "main",
                        lastOpenedAt: 1,
                        name: "example",
                        path: "/tmp/example",
                    },
                ],
            }),
        );

        expect(markup).toContain('aria-label="Recent Projects"');
        expect(markup).toContain('aria-keyshortcuts="Enter"');
        expect(markup).toMatch(/tabindex="0"[^>]*role="option"/);
        expect(markup).toContain("/tmp/example");
        expect(markup).toContain("main");
    });
});
