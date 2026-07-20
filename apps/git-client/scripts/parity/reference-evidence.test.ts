import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseReferenceManifest,
  resolveScenarioReference,
  verifyReferenceEvidence,
} from "./reference-evidence.mjs";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function manifest(path: string, hash: string): unknown {
  return {
    schemaVersion: 1,
    reference: {
      product: "Rebased",
      version: "1.1.8",
      build: "IC-262.8665.SNAPSHOT",
      sourceCommit: "b".repeat(40),
      artifact: { name: "rebased-aarch64.dmg", sha256: "a".repeat(64) },
    },
    evidence: [{ id: "welcome.projects", kind: "accessibility", path, sha256: hash }],
  };
}

describe("reference evidence", () => {
  it("accepts only evidence whose content matches the pinned hash", async () => {
    const root = mkdtempSync(join(tmpdir(), "git-client-parity-"));
    writeFileSync(join(root, "reference.json"), "reference evidence");

    const result = await verifyReferenceEvidence(
      root,
      parseReferenceManifest(manifest("reference.json", sha256("reference evidence"))),
    );

    expect(result).toEqual({ verified: true, failures: [] });
  });

  it("fails closed when reference evidence is changed", async () => {
    const root = mkdtempSync(join(tmpdir(), "git-client-parity-"));
    writeFileSync(join(root, "reference.json"), "tampered");

    const result = await verifyReferenceEvidence(
      root,
      parseReferenceManifest(manifest("reference.json", sha256("reference evidence"))),
    );

    expect(result.verified).toBe(false);
    expect(result.failures[0]).toMatchObject({ id: "welcome.projects", reason: "hash-mismatch" });
  });

  it("rejects malformed manifests before reading evidence", () => {
    expect(() => parseReferenceManifest({ schemaVersion: 1, evidence: [] })).toThrow();
  });

  it("does not trust a scenario's stored verified flag", () => {
    const parsedManifest = parseReferenceManifest(
      manifest("reference.json", sha256("reference evidence")),
    );

    expect(
      resolveScenarioReference(
        {
          authority: "golden",
          evidenceIds: ["missing-evidence"],
          evidenceVerified: true,
          expected: { structure: {} },
        },
        parsedManifest,
        { verified: true, failures: [] },
      ).evidenceVerified,
    ).toBe(false);
  });

  it("verifies every pinned Rebased 1.1.8 evidence file", async () => {
    const manifestPath = resolve(import.meta.dirname, "../../parity/rebased/1.1.8/reference.json");
    const currentManifest = parseReferenceManifest(
      JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    );

    await expect(verifyReferenceEvidence(dirname(manifestPath), currentManifest)).resolves.toEqual({
      verified: true,
      failures: [],
    });
  });
});
