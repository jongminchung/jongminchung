import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly exports?: Record<string, unknown>;
  readonly files?: readonly string[];
  readonly license?: string;
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
  readonly sideEffects?: readonly string[];
  readonly version?: string;
}

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const dependencyGroups = ["dependencies", "devDependencies", "peerDependencies"] as const;

function collectDependencyRanges(packageJson: PackageJson): readonly string[] {
  return dependencyGroups.flatMap((group) => Object.values(packageJson[group] ?? {}));
}

describe("@jongminchung/ui package contract", () => {
  it("keeps primitive files behind the root design module", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

    expect(Object.keys(packageJson.exports ?? {})).toEqual([
      ".",
      "./styles.css",
      "./tokens.css",
      "./baseline.css",
      "./package.json",
    ]);
  });

  it("declares the metadata needed for public npm publishing", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

    expect(packageJson.private).not.toBe(true);
    expect(packageJson.version).toBe("1.0.0");
    expect(packageJson.license).toBe("MIT");
    expect(packageJson.repository).toEqual({
      type: "git",
      url: "git+https://github.com/jongminchung/jongminchung.git",
      directory: "packages/ui",
    });
    expect(packageJson.publishConfig).toEqual({
      access: "public",
      registry: "https://npm.pkg.github.com",
    });
    expect(packageJson.scripts?.build).toBe("tsdown --log-level error --no-report");
    expect(packageJson.scripts?.["publish:dry-run"]).toBe("pnpm publish --dry-run --access public");
    expect(packageJson.devDependencies?.tsdown).toBe("^0.22.7");
    expect(collectDependencyRanges(packageJson)).not.toContain("catalog:");
    expect(packageJson.files).toEqual([
      "dist",
      "src/index.ts",
      "src/design-system.ts",
      "src/styles.css",
      "src/baseline.css",
      "src/components/ui/badge.tsx",
      "src/components/ui/button.tsx",
      "src/components/ui/card.tsx",
      "src/lib/utils.ts",
      "LICENSE",
      "README.md",
    ]);
    expect(packageJson.sideEffects).toEqual([
      "./dist/styles.css",
      "./dist/baseline.css",
      "./src/styles.css",
      "./src/baseline.css",
    ]);
    expect(packageJson.peerDependencies).toMatchObject({
      react: ">=19.0.0",
      "react-dom": ">=19.0.0",
      tailwindcss: ">=4.0.0",
    });
  });
});
