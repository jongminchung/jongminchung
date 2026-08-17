import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice } from "./Notice";

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
        expect(status).toContain('role="status"');
        expect(alert).toContain("Remote commits may be replaced.");
        expect(status).toContain("Repository created.");
    });
});
