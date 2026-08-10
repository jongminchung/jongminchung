import { describe, expect, it } from "vitest";
import { defineOxfmtConfig } from "./index.js";

describe("oxfmt config", () => {
  it("adds local ignore patterns after shared defaults", () => {
    const config = defineOxfmtConfig({
      ignorePatterns: ["fixtures/generated/"],
    });

    expect(config.ignorePatterns).toContain("node_modules/");
    expect(config.ignorePatterns.at(-1)).toBe("fixtures/generated/");
  });
});
