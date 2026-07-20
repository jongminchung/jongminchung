import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildActionRegistry, loadActionRegistryInputs } from "./build-action-registry.mjs";

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(`${APP_ROOT}${relativePath}`, "utf8"));
}

describe("Rebased generated action registry", () => {
  it("covers every source obligation and every candidate command", () => {
    const registry = buildActionRegistry(loadActionRegistryInputs());
    expect(registry.summary).toEqual({
      boundCandidateCommands: 243,
      sourceObligations: 7_260,
      sourceObligationsWithCandidateBindings: 230,
      unresolvedSourceObligations: 7_041,
    });
    expect(new Set(registry.entries.map((entry) => entry.sourceId)).size).toBe(7_260);
    const bindings = registry.entries.flatMap((entry) => entry.candidateBindings);
    expect(new Set(bindings.map((binding) => binding.commandId)).size).toBe(243);
    expect(
      bindings.every(
        (binding) =>
          binding.visibleWhen.length > 0 &&
          binding.enabledWhen.length > 0 &&
          binding.nativeBoundary.length > 0 &&
          binding.testSurface.length > 0,
      ),
    ).toBe(true);
  });

  it("matches the checked-in deterministic registry", () => {
    expect(readJson("parity/rebased/1.1.8/source/action-registry.json")).toEqual(
      buildActionRegistry(loadActionRegistryInputs()),
    );
  });
});
