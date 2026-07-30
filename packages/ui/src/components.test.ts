import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./components/button";
import { Checkbox } from "./components/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "./components/field";
import { Item, ItemContent, ItemTitle } from "./components/item";
import { Spinner } from "./components/spinner";

describe("shared UI behavior", () => {
  it("keeps buttons native and styles links without rendering a Base UI button", () => {
    const button = renderToStaticMarkup(
      createElement(
        Button,
        { "aria-busy": true, disabled: true, size: "sm", variant: "default" },
        createElement(Spinner, { "aria-hidden": true }),
        "Save",
      ),
    );
    const link = renderToStaticMarkup(
      createElement(
        "a",
        { className: buttonVariants({ size: "sm", variant: "link" }), href: "/docs" },
        "Docs",
      ),
    );

    expect(button).toContain("<button");
    expect(button).toContain('disabled=""');
    expect(button).toContain('aria-busy="true"');
    expect(button).toContain("Save");
    expect(link).toContain('<a class="');
    expect(link).toContain('href="/docs"');
    expect(link).not.toContain("<button");
  });

  it("connects descriptions and errors to invalid fields", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Field,
        null,
        createElement(FieldLabel, { htmlFor: "branch" }, "Branch"),
        createElement("input", {
          "aria-describedby": "branch-description branch-error",
          "aria-invalid": true,
          id: "branch",
        }),
        createElement(FieldDescription, { id: "branch-description" }, "Use a short branch name."),
        createElement(FieldError, { id: "branch-error" }, "Branch is required."),
      ),
    );

    expect(markup).toContain('for="branch"');
    expect(markup).toContain('aria-describedby="branch-description branch-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('id="branch-error"');
    expect(markup).toContain('role="alert"');
  });

  it("renders mixed checkboxes and preserves static versus actionable item roles", () => {
    const mixed = renderToStaticMarkup(
      createElement(Checkbox, {
        "aria-label": "Select all files",
        indeterminate: true,
      }),
    );
    const staticItem = renderToStaticMarkup(
      createElement(
        Item,
        { role: "listitem" },
        createElement(ItemContent, null, createElement(ItemTitle, null, "README.md")),
      ),
    );
    const actionItem = renderToStaticMarkup(
      createElement(
        Item,
        { render: createElement("button", { type: "button" }) },
        createElement(ItemContent, null, createElement(ItemTitle, null, "Open")),
      ),
    );

    expect(mixed).toContain('aria-checked="mixed"');
    expect(staticItem).toContain('role="listitem"');
    expect(staticItem).toContain("<div");
    expect(actionItem).toContain("<button");
    expect(actionItem).not.toContain('role="listitem"');
  });
});
