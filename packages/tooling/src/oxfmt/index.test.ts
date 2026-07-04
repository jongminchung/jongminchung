import { describe, expect, it } from "vitest";
import { defaultOxfmtConfig, defineOxfmtConfig } from "./index.js";

describe("oxfmt config", () => {
  it("keeps generated files out of generic defaults", () => {
    expect(defaultOxfmtConfig.ignorePatterns).not.toContain("website/src/routeTree.gen.ts");
  });

  it("adds local ignore patterns after shared defaults", () => {
    const config = defineOxfmtConfig({
      ignorePatterns: ["fixtures/generated/"],
    });

    expect(config.ignorePatterns).toContain("node_modules/");
    expect(config.ignorePatterns).toContain("fixtures/generated/");
  });
});
