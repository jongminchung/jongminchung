import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  designSystem,
} from "@jongminchung/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("@jongminchung/ui public module", () => {
  it("exports the shared design system tokens", () => {
    expect(designSystem.colors.ink).toBe("#171717");
    expect(designSystem.colors.canvas).toBe("#fafafa");
    expect(designSystem.typography.displayXl.fontFamily).toContain("Geist");
  });

  it("renders exported shadcn primitives with the real React server renderer", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Card,
        null,
        createElement(CardHeader, null, createElement(CardTitle, null, "Session")),
        createElement(
          CardContent,
          null,
          createElement(Badge, { variant: "success" }, "running"),
          createElement(Button, { variant: "secondary", size: "sm" }, "Open"),
        ),
      ),
    );

    expect(markup).toContain("Session");
    expect(markup).toContain("bg-cyan-soft");
    expect(markup).toContain("bg-canvas-elevated");
  });
});
