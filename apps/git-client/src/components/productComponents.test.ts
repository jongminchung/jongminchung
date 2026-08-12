import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice } from "./Notice";
import {
    EmptyState,
    Spinner,
    StatePill,
    StatusBadge,
} from "./ProductCollections";
import { DialogBody, DialogFooter } from "./ProductDialog";

describe("Git Client product component variants", () => {
    it("renders notice tone and live-region roles as public behavior", () => {
        const alert = renderToStaticMarkup(
            createElement(
                Notice,
                {
                    role: "alert",
                    tone: "destructive",
                },
                "Remote commits may be replaced.",
            ),
        );
        const status = renderToStaticMarkup(
            createElement(
                Notice,
                {
                    role: "status",
                    size: "sm",
                    tone: "success",
                },
                "Repository created.",
            ),
        );

        expect(alert).toContain('role="alert"');
        expect(alert).toContain("bg-destructive-muted");
        expect(status).toContain('role="status"');
        expect(status).toContain("bg-success-muted");
    });

    it("provides consistent dialog body and footer composition", () => {
        const markup = renderToStaticMarkup(
            createElement(
                "section",
                null,
                createElement(DialogBody, null, "Body"),
                createElement(DialogFooter, { alignment: "between" }, "Footer"),
            ),
        );

        expect(markup).toContain("overflow-auto");
        expect(markup).toContain("justify-between");
        expect(markup).toContain("border-t");
    });

    it("composes product status and state recipes from shared primitives", () => {
        const markup = renderToStaticMarkup(
            createElement(
                "section",
                null,
                createElement(Spinner, { label: "Loading changes…" }),
                createElement(EmptyState, {
                    description: "There are no local changes.",
                    icon: createElement("span", null, "!"),
                    title: "Working tree clean.",
                }),
                createElement(StatusBadge, null, "M"),
                createElement(StatePill, null, "Shallow"),
                createElement(
                    StatePill,
                    { role: "status", tone: "destructive" },
                    "Rebase in progress",
                ),
            ),
        );

        expect(markup).toContain('data-slot="spinner"');
        expect(markup).toContain('data-slot="empty"');
        expect(markup).toContain('data-slot="empty-icon"');
        expect(markup.match(/data-slot="badge"/g)).toHaveLength(3);
        expect(markup).toContain("bg-destructive-muted");
        expect(markup).toContain('role="status"');
        expect(markup).toContain("Working tree clean.");
    });
});
