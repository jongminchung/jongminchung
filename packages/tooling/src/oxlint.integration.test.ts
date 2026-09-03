import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../../..");

interface PrintedOxlintConfig {
  readonly categories: Readonly<Record<string, string>>;
  readonly options: { readonly typeAware?: boolean };
  readonly plugins: readonly string[];
  readonly rules: Readonly<Record<string, unknown>>;
}

function readResolvedConfig(): PrintedOxlintConfig {
  const output = execFileSync(
    resolve(workspaceRoot, "node_modules/.bin/oxlint"),
    ["--config", "oxlint.config.ts", "--print-config"],
    { cwd: workspaceRoot, encoding: "utf8" },
  );
  return JSON.parse(output) as PrintedOxlintConfig;
}

describe("해결된 Oxlint 구성", () => {
  it("[성공] 기준점과 기준점 규칙을", () => {
    const config = readResolvedConfig();

    expect(config.categories.correctness).toBe("deny");
    expect(config.options.typeAware).toBe(true);
    expect(config.plugins).toEqual(
      expect.arrayContaining([
        "typescript",
        "unicorn",
        "oxc",
        "react",
        "jsx-a11y",
      ]),
    );
    expect(config.rules["prefer-const"]).toBe("deny");
    expect(config.rules["typescript/no-explicit-any"]).toBe("deny");
    expect(config.rules["typescript/no-misused-promises"]).toBe("deny");
    expect(config.rules["jsx_a11y/prefer-tag-over-role"]).toBe("allow");
    expect(config.rules["jsx_a11y/label-has-associated-control"]).toEqual(
      expect.arrayContaining(["deny"]),
    );
    expect(config.rules["jsx_a11y/no-noninteractive-tabindex"]).toEqual(
      expect.arrayContaining(["deny"]),
    );
  });
});
