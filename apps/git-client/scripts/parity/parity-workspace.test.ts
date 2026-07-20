import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCurrentCompletionInput, computeCandidateBuildHash } from "./parity-workspace.mjs";

describe("parity workspace", () => {
  it("changes the candidate build hash when implementation content changes", async () => {
    const root = mkdtempSync(join(tmpdir(), "git-client-build-"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "app.ts"), "export const value = 1;\n");
    writeFileSync(join(root, "package.json"), "{}\n");
    const first = await computeCandidateBuildHash(root);

    writeFileSync(join(root, "src", "app.ts"), "export const value = 2;\n");

    expect(await computeCandidateBuildHash(root)).not.toBe(first);
  });

  it("builds a fail-closed current report from individual repository evidence", async () => {
    const input = await buildCurrentCompletionInput({
      appRoot: resolve(import.meta.dirname, "../.."),
    });

    expect(input.referenceVerified).toBe(true);
    expect(input.obligations).toHaveLength(7_260);
    expect(
      input.obligations.filter(({ status }) => status === "unverified" || status === "invalid"),
    ).toHaveLength(7_260);
    expect(input.bridgeMethods).toHaveLength(43);
    expect(input.releaseGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gate: "package-e2e", status: "passed" }),
        expect.objectContaining({ gate: "soak", status: "unverified" }),
        expect.objectContaining({ gate: "notarization", status: "unverified" }),
      ]),
    );
  });
});
