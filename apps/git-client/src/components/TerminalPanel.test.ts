import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_TERMINAL } from "../application/terminal/ports/TerminalAvailability";
import { TerminalPanel } from "./TerminalPanel";

describe("TerminalPanel availability", () => {
    it("renders the fixture empty state without touching the native service", () => {
        const markup = renderToStaticMarkup(
            createElement(TerminalPanel, {
                availability: UNAVAILABLE_TERMINAL,
                repositoryId: "repository-1",
                onHide: vi.fn(),
            }),
        );

        expect(markup).toContain("Native Terminal");
        expect(markup).toContain(
            "The deterministic QA fixture does not start a shell.",
        );
    });
});
