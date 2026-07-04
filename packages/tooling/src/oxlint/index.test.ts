import { describe, expect, it } from "vitest";
import { defaultOxlintConfig, defineOxlintConfig } from "./index.js";

describe("oxlint config", () => {
  it("provides defaults and lets projects override rules", () => {
    const config = defineOxlintConfig({
      rules: {
        "typescript/no-explicit-any": "error",
      },
    });

    expect(config.options.typeAware).toBe(true);
    expect(config.rules["typescript/no-floating-promises"]).toBe("error");
    expect(config.rules["typescript/no-explicit-any"]).toBe("error");
    expect(defaultOxlintConfig.rules["typescript/no-explicit-any"]).toBe("warn");
  });
});
