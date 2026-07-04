import { describe, expect, it } from "vitest";
import { cn } from "./utils.ts";

describe("cn", () => {
  it("merges conditional classes and lets later Tailwind utilities win", () => {
    expect(cn("px-2 text-sm", undefined, "px-4", ["font-mono"])).toBe("text-sm px-4 font-mono");
  });
});
