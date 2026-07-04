import { describe, expect, it } from "vitest";
import { createPlantUmlRemarkPlugin } from "./astro.js";
import remarkPlantUml from "./index.js";

describe("createPlantUmlRemarkPlugin", () => {
  it("creates an Astro-compatible remark plugin tuple", () => {
    const options = {
      contentRoot: "src/content/docs",
      serverBaseUrl: "https://plantuml.example.com/plantuml/svg",
    };

    expect(createPlantUmlRemarkPlugin(options)).toEqual([remarkPlantUml, options]);
  });
});
