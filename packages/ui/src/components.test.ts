import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./components/button";
import { Checkbox } from "./components/checkbox";
import { Command, CommandInput, CommandItem, CommandList } from "./components/command";
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

  it("deduplicates form error messages while preserving distinct failures", () => {
    const markup = renderToStaticMarkup(
      createElement(FieldError, {
        errors: [
          { message: "Branch is required." },
          { message: "Branch is required." },
          { message: "Branch already exists." },
        ],
      }),
    );

    expect(markup.match(/Branch is required\./gu)).toHaveLength(1);
    expect(markup.match(/Branch already exists\./gu)).toHaveLength(1);
    expect(markup).toContain("<ul");
    expect(markup).toContain('role="alert"');
  });

  it("keeps the default cmdk input and item markup", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Command,
        { label: "Repository commands" },
        createElement(CommandInput, { "aria-label": "Search commands" }),
        createElement(CommandList, null, createElement(CommandItem, null, "Open repository")),
      ),
    );

    expect(markup).toContain('data-slot="command"');
    expect(markup).toContain('data-slot="command-input"');
    expect(markup).toContain('aria-label="Search commands"');
    expect(markup).toContain('data-slot="command-item"');
  });

  it("renders mixed checkboxes and preserves static versus actionable item roles", () => {
    const mixed = renderToStaticMarkup(
      createElement(Checkbox, {
        "aria-label": "Select all files",
        indeterminate: true,
      }),
    );
    const checked = renderToStaticMarkup(
      createElement(Checkbox, {
        "aria-label": "Select file",
        checked: true,
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
    expect(mixed).toContain("lucide-minus");
    expect(mixed).not.toContain("lucide-check");
    expect(checked).toContain("lucide-check");
    expect(checked).not.toContain("lucide-minus");
    expect(staticItem).toContain('role="listitem"');
    expect(staticItem).toContain("<div");
    expect(actionItem).toContain("<button");
    expect(actionItem).not.toContain('role="listitem"');
  });
});
