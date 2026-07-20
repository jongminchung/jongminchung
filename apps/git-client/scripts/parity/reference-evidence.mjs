import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

const referenceManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    reference: z
      .object({
        product: z.literal("Rebased"),
        version: z.string().min(1),
        build: z.string().min(1),
        sourceCommit: z.string().regex(/^[a-f0-9]{40}$/u),
        artifact: z.object({ name: z.string().min(1), sha256: sha256Schema }).strict(),
      })
      .strict(),
    evidence: z
      .array(
        z
          .object({
            id: z.string().min(1),
            kind: z.enum(["accessibility", "behavior", "git", "screenshot", "source"]),
            path: z.string().min(1),
            sha256: sha256Schema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    for (const key of ["id", "path"]) {
      const values = manifest.evidence.map((evidence) => evidence[key]);
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: "custom", message: `evidence ${key} values must be unique` });
      }
    }
  });

export function parseReferenceManifest(value) {
  return referenceManifestSchema.parse(value);
}

function isWithinRoot(root, path) {
  const relativePath = relative(root, path);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

export async function verifyReferenceEvidence(root, manifest) {
  const resolvedRoot = resolve(root);
  const failures = [];
  for (const evidence of manifest.evidence) {
    const evidencePath = resolve(resolvedRoot, evidence.path);
    if (!isWithinRoot(resolvedRoot, evidencePath)) {
      failures.push({ id: evidence.id, path: evidence.path, reason: "unsafe-path" });
      continue;
    }
    let content;
    try {
      content = await readFile(evidencePath);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        failures.push({ id: evidence.id, path: evidence.path, reason: "missing" });
        continue;
      }
      throw error;
    }
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== evidence.sha256) {
      failures.push({
        id: evidence.id,
        path: evidence.path,
        reason: "hash-mismatch",
        expected: evidence.sha256,
        actual,
      });
    }
  }
  return Object.freeze({ verified: failures.length === 0, failures: Object.freeze(failures) });
}

export function resolveScenarioReference(scenarioReference, manifest, integrity) {
  const knownEvidence = new Set(manifest.evidence.map((evidence) => evidence.id));
  const evidenceIds = Array.isArray(scenarioReference.evidenceIds)
    ? scenarioReference.evidenceIds
    : [];
  const evidenceVerified =
    integrity.verified &&
    scenarioReference.authority !== "legacy-manual" &&
    evidenceIds.length > 0 &&
    evidenceIds.every((id) => typeof id === "string" && knownEvidence.has(id));
  return Object.freeze({ ...scenarioReference, evidenceVerified });
}
