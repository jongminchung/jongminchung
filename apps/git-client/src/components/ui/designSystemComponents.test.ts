import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DialogBody, DialogFooter } from "./dialog";
import { Notice } from "./notice";

describe("Git Client product component variants", () => {
  it("renders notice tone and live-region roles as public behavior", () => {
    const alert = renderToStaticMarkup(
      createElement(Notice, {
        children: "Remote commits may be replaced.",
        role: "alert",
        tone: "destructive",
      }),
    );
    const status = renderToStaticMarkup(
      createElement(Notice, {
        children: "Repository created.",
        role: "status",
        size: "sm",
        tone: "success",
      }),
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
});
