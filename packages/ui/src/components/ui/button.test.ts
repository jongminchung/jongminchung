import { describe, expect, it } from "vitest";
import { badgeVariants, buttonVariants } from "../../index.ts";

describe("UI variants", () => {
  it("keeps button variant classes behind the public variant interface", () => {
    expect(buttonVariants({ variant: "secondary", size: "sm" })).toContain("bg-canvas-elevated");
    expect(buttonVariants({ variant: "secondary", size: "sm" })).toContain("h-8");
    expect(buttonVariants({ variant: "secondary", size: "sm" })).toContain("rounded-sm");
  });

  it("keeps badge status variants behind the public variant interface", () => {
    expect(badgeVariants({ variant: "warning" })).toContain("bg-warning-soft");
  });
});
