import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkIconAssets, generateIconAssets } from "./assets.ts";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("tracked icon assets", () => {
  it("match the canonical package source", async () => {
    expect(await checkIconAssets(workspaceRoot)).toEqual([]);
  });

  it("reports stale and missing generated files", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "icon-assets-"));
    try {
      await generateIconAssets(temporaryRoot);
      await writeFile(resolve(temporaryRoot, "apps/readme/app/icon.svg"), "stale\n", "utf8");
      await unlink(resolve(temporaryRoot, "apps/engineering-docs/app/icon.svg"));

      const differences = await checkIconAssets(temporaryRoot);
      expect(differences).toHaveLength(2);
      expect(differences).toEqual(
        expect.arrayContaining([
          {
            path: "apps/readme/app/icon.svg",
            reason: "SVG does not match the canonical source",
          },
          {
            path: "apps/engineering-docs/app/icon.svg",
            reason: "file is missing",
          },
        ]),
      );
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("ignores workspace apps that do not opt into generated icon assets", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "icon-apps-"));
    try {
      await generateIconAssets(temporaryRoot);
      const unmappedRoot = resolve(temporaryRoot, "apps/unmapped");
      await mkdir(unmappedRoot, { recursive: true });
      await writeFile(resolve(unmappedRoot, "package.json"), "{}\n", "utf8");

      expect(await checkIconAssets(temporaryRoot)).toEqual([]);
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
