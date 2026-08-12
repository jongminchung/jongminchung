import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sampleSnapshot } from "../domain/sampleData";
import { CommandProvider } from "./CommandProvider";
import { ProjectSwitcherPopup } from "./ProjectSwitcherPopup";

describe("ProjectSwitcherPopup", () => {
    it("starts on the direct Open action and exposes keyboard-accessible recent projects", () => {
        const markup = renderToStaticMarkup(
            createElement(
                CommandProvider,
                null,
                createElement(ProjectSwitcherPopup, {
                    activeRepositoryId: sampleSnapshot.id,
                    onActivate: vi.fn(() => Promise.resolve()),
                    onClone: vi.fn(),
                    onClose: vi.fn(),
                    onOpen: vi.fn(),
                    onOpenRecent: vi.fn(() => Promise.resolve()),
                    onRemoveRecent: vi.fn(),
                    openRepositories: [sampleSnapshot],
                    recentProjects: [
                        {
                            branch: "topic",
                            lastOpenedAt: 1,
                            name: "recent-project",
                            path: "/tmp/recent-project",
                        },
                    ],
                }),
            ),
        );

        expect(markup).toContain('aria-label="Projects"');
        expect(markup).not.toContain('autofocus=""');
        expect(markup).toContain(">Open…<");
        expect(markup).toContain('aria-keyshortcuts="Enter Delete Backspace"');
        expect(markup).toContain("/tmp/recent-project");
        expect(markup.indexOf(">Open…<")).toBeLessThan(
            markup.indexOf("Open Projects"),
        );
    });
});
