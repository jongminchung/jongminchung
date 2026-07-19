import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRODUCT_SETTINGS } from "../domain/productSettings";
import { WelcomeWorkspace } from "./WelcomeWorkspace";

describe("WelcomeWorkspace", () => {
    it("matches the Rebased welcome project actions and category structure", () => {
        const markup = renderToStaticMarkup(
            createElement(WelcomeWorkspace, {
                appearanceMode: "dark",
                onAppearanceModeChange: vi.fn(),
                onCloneRepository: vi.fn(),
                onImportSettings: vi.fn(),
                onNewProject: vi.fn(),
                onOpenRecent: vi.fn(),
                onOpenRepository: vi.fn(),
                onOpenSettings: vi.fn(),
                onProductSettingsChange: vi.fn(),
                productSettings: DEFAULT_PRODUCT_SETTINGS,
                recentRepositories: [],
            }),
        );

        expect(markup).toContain('aria-label="Welcome screen categories"');
        expect(markup).toContain("Welcome to Git Client");
        expect(markup).toContain("New Project");
        expect(markup).toContain("Open");
        expect(markup).toContain("Clone Repository");
        expect(markup).toContain("Customize");
        expect(markup).toContain("Plugins");
    });

    it("renders persisted recent projects as actionable rows", () => {
        const markup = renderToStaticMarkup(
            createElement(WelcomeWorkspace, {
                appearanceMode: "dark",
                onAppearanceModeChange: vi.fn(),
                onCloneRepository: vi.fn(),
                onImportSettings: vi.fn(),
                onNewProject: vi.fn(),
                onOpenRecent: vi.fn(),
                onOpenRepository: vi.fn(),
                onOpenSettings: vi.fn(),
                onProductSettingsChange: vi.fn(),
                productSettings: DEFAULT_PRODUCT_SETTINGS,
                recentRepositories: ["/tmp/example"],
            }),
        );

        expect(markup).toContain("Recent Projects");
        expect(markup).toContain("/tmp/example");
    });
});
