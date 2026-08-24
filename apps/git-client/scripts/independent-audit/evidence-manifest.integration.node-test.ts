// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  checkedInEvidenceRoot,
  validateEvidenceBundle,
} from "./validate-evidence.ts";

const temporaryRoots: any[] = [];

async function copyEvidence() {
  const root = await mkdtemp(join(tmpdir(), "git-client-evidence-test-"));
  temporaryRoots.push(root);
  await cp(checkedInEvidenceRoot, root, { recursive: true });
  return root;
}

async function replaceManifestDigest(
  root: any,
  relativePath: any,
  digest: any,
) {
  const manifestPath = join(root, "SHA256SUMS");
  const manifest = await readFile(manifestPath, "utf8");
  const suffix = `  ./${relativePath}`;
  const next = manifest
    .split("\n")
    .map((line: any) => (line.endsWith(suffix) ? `${digest}${suffix}` : line))
    .join("\n");
  await writeFile(manifestPath, next);
}

after(async () => {
  for (const root of temporaryRoots)
    await rm(root, { recursive: true, force: true });
});

void describe("Rebased 1.1.11 independent evidence manifest", () => {
  void it("validates every checked-in file, digest, metadata field, and referenced path", async () => {
    assert.deepEqual(await validateEvidenceBundle(), {
      files: 9,
      applicationVersion: "1.1.11",
    });
  });

  void it("fails closed when a manifested file is missing", async () => {
    const root = await copyEvidence();
    await rm(join(root, "ax/01-welcome.txt"));
    await assert.rejects(validateEvidenceBundle(root), /coverage mismatch/u);
  });

  void it("fails closed when a file hash changes", async () => {
    const root = await copyEvidence();
    await writeFile(join(root, "ax/01-welcome.txt"), "tampered\n");
    await assert.rejects(validateEvidenceBundle(root), /SHA-256 mismatch/u);
  });

  void it("fails closed when an unmanifested file is added", async () => {
    const root = await copyEvidence();
    await writeFile(join(root, "unexpected.txt"), "unexpected\n");
    await assert.rejects(validateEvidenceBundle(root), /coverage mismatch/u);
  });

  void it("fails closed for incorrect application metadata", async () => {
    const root = await copyEvidence();
    const metadataPath = join(root, "evidence.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.application.version = "1.1.10";
    const contents = `${JSON.stringify(metadata, null, 2)}\n`;
    await writeFile(metadataPath, contents);
    const { createHash } = await import("node:crypto");
    const digest = createHash("sha256").update(contents).digest("hex");
    await replaceManifestDigest(root, "evidence.json", digest);
    await assert.rejects(
      validateEvidenceBundle(root),
      /identify Rebased 1\.1\.11/u,
    );
  });

  void it("fails closed for a metadata path outside the screenshot directory", async () => {
    const root = await copyEvidence();
    const metadataPath = join(root, "evidence.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    metadata.welcome.screenshot = "../README.md";
    const contents = `${JSON.stringify(metadata, null, 2)}\n`;
    await writeFile(metadataPath, contents);
    const { createHash } = await import("node:crypto");
    const digest = createHash("sha256").update(contents).digest("hex");
    await replaceManifestDigest(root, "evidence.json", digest);
    await assert.rejects(validateEvidenceBundle(root), /Unsafe evidence path/u);
  });
});
