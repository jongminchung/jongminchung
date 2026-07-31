import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly exports?: Record<string, unknown>;
  readonly files?: readonly string[];
  readonly license?: string;
  readonly optionalDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly repository?: {
    readonly directory?: string;
    readonly type?: string;
    readonly url?: string;
  };
  readonly private?: boolean;
  readonly publishConfig?: {
    readonly access?: string;
    readonly registry?: string;
  };
  readonly scripts?: Record<string, string>;
  readonly version?: string;
}

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const publishedDependencyGroups = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;
const stableSemverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

function collectPublishedDependencyRanges(packageJson: PackageJson): readonly string[] {
  return publishedDependencyGroups.flatMap((group) => Object.values(packageJson[group] ?? {}));
}

describe("@jongminchung/tooling package contract", () => {
  it("declares the metadata needed for public npm publishing", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

    expect(packageJson.private).not.toBe(true);
    expect(packageJson.version).toMatch(stableSemverPattern);
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/jongminchung/jongminchung.git",
      directory: "packages/tooling",
    });
    expect(packageJson.publishConfig).toEqual({
      access: "public",
      registry: "https://npm.pkg.github.com",
    });
    expect(packageJson.scripts?.build).toBe("tsdown --log-level error --no-report");
    expect(packageJson.scripts?.["publish:dry-run"]).toBe("pnpm publish --dry-run --access public");
    expect(packageJson.dependencies).toBeUndefined();
    expect(collectPublishedDependencyRanges(packageJson)).not.toContain("catalog:");
    expect(packageJson.files).toEqual([
      "dist",
      "src/oxfmt/index.ts",
      "src/**/*.json",
      "src/oxlint/index.ts",
      "src/package-map.ts",
      "LICENSE",
      "README.md",
    ]);
    expect(Object.keys(packageJson.exports ?? {})).toEqual([
      "./oxlint",
      "./oxfmt",
      "./package-map",
      "./oxlint.json",
      "./package.json",
    ]);
  });
});
