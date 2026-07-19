import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface WorkflowPolicy {
  readonly actions: Readonly<Record<string, readonly string[]>>;
  readonly file: string;
  readonly setupNodeCount: number;
}

const workspaceRoot = new URL("../../../", import.meta.url);
const nodeVersionVerification = 'run: test "v$(cat .node-version)" = "$(node --version)"';

const workflowPolicies: readonly WorkflowPolicy[] = [
  {
    actions: {
      "actions/checkout": ["v7", "v7", "v7"],
      "actions/setup-node": ["v7", "v7", "v7"],
      "actions/upload-artifact": ["v7"],
      "pnpm/action-setup": ["v6", "v6", "v6"],
    },
    file: ".github/workflows/git-client.yml",
    setupNodeCount: 3,
  },
  {
    actions: {
      "actions/checkout": ["v7"],
      "actions/setup-node": ["v7"],
      "actions/upload-artifact": [],
      "pnpm/action-setup": ["v6"],
    },
    file: ".github/workflows/publish-packages.yml",
    setupNodeCount: 1,
  },
];

function findActionVersions(contents: string, action: string): readonly string[] {
  const prefix = `- uses: ${action}@`;
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length));
}

function countOccurrences(contents: string, value: string): number {
  return contents.split(value).length - 1;
}

function readNodeEngine(value: unknown): string {
  if (typeof value !== "object" || value === null || !("engines" in value)) {
    throw new Error("Root package.json must define engines");
  }
  const engines = value.engines;
  if (typeof engines !== "object" || engines === null || !("node" in engines)) {
    throw new Error("Root package.json must define engines.node");
  }
  if (typeof engines.node !== "string") throw new Error("engines.node must be a string");
  return engines.node;
}

describe("Node.js workflow configuration", () => {
  it.each(workflowPolicies)(
    "uses current actions and the workspace Node version in $file",
    (policy) => {
      const contents = readFileSync(new URL(policy.file, workspaceRoot), "utf8");

      for (const [action, expectedVersions] of Object.entries(policy.actions)) {
        expect(findActionVersions(contents, action)).toEqual(expectedVersions);
      }
      expect(countOccurrences(contents, "node-version-file: .node-version")).toBe(
        policy.setupNodeCount,
      );
      expect(countOccurrences(contents, "Verify configured Node.js")).toBe(policy.setupNodeCount);
      expect(countOccurrences(contents, nodeVersionVerification)).toBe(policy.setupNodeCount);
      expect(contents).not.toMatch(/node-version:\s*26/);
    },
  );

  it("keeps the runtime file and package engine on Node.js 26.5.0", () => {
    const nodeVersion = readFileSync(new URL(".node-version", workspaceRoot), "utf8").trim();
    const packageConfig: unknown = JSON.parse(
      readFileSync(new URL("package.json", workspaceRoot), "utf8"),
    );

    expect(nodeVersion).toBe("26.5.0");
    expect(readNodeEngine(packageConfig)).toBe(">=26.5.0");
  });

  it("uses Electron ARM64 artifacts and fail-closed production signing in Git Client CI", () => {
    const contents = readFileSync(
      new URL(".github/workflows/git-client.yml", workspaceRoot),
      "utf8",
    );

    expect(contents).toContain("release:validate-local -- 0.1.0");
    expect(contents).toContain("git-client-macos-arm64-adhoc");
    expect(contents).toContain("GIT_CLIENT_CODESIGN_IDENTITY");
    expect(contents).toContain("GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE: git-client-ci");
    expect(contents).toContain("xcrun notarytool store-credentials git-client-ci");
    expect(contents).toContain("pnpm --filter @jongminchung/git-client release:validate-local");
  });
});
