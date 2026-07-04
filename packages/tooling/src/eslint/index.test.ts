import {
  createPackageBoundaryEslintConfig,
  defaultEslintIgnores,
  onlyDependOnTagsFor,
} from "@jongminchung/tooling/eslint";
import { describe, expect, it } from "vitest";

describe("package-boundary config", () => {
  it("finds allowed dependency tags from project-provided constraints", () => {
    const depConstraints = [
      {
        sourceTag: "scope:app",
        onlyDependOnLibsWithTags: ["scope:app", "scope:ui"],
      },
    ];

    expect(onlyDependOnTagsFor(depConstraints, "scope:app")).toEqual(["scope:app", "scope:ui"]);
    expect(onlyDependOnTagsFor(depConstraints, "scope:missing")).toEqual([]);
  });

  it("builds an Nx module-boundary rule from project-provided constraints", () => {
    const depConstraints = [
      {
        sourceTag: "scope:tooling",
        onlyDependOnLibsWithTags: ["scope:tooling"],
      },
    ];

    const config = createPackageBoundaryEslintConfig({ depConstraints });

    expect(config[0]).toEqual({ ignores: defaultEslintIgnores });
    expect(config[1]).toMatchObject({
      rules: {
        "@nx/enforce-module-boundaries": [
          "error",
          {
            allow: [],
            allowCircularSelfDependency: true,
            depConstraints,
          },
        ],
      },
    });
  });
});
