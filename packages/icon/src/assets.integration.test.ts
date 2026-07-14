import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkIconAssets, generateIconAssets } from "./assets.ts";
import { iconApplicationIds } from "./targets.ts";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function createApplicationManifests(workspaceRoot: string): Promise<void> {
  await Promise.all(
    iconApplicationIds.map(async (application): Promise<void> => {
      const applicationRoot = resolve(workspaceRoot, "apps", application);
      await mkdir(applicationRoot, { recursive: true });
      await writeFile(resolve(applicationRoot, "package.json"), "{}\n", "utf8");
    }),
  );
}

describe("tracked icon assets", () => {
  it("match the canonical package source", async () => {
    expect(await checkIconAssets(workspaceRoot)).toEqual([]);
  });

  it("reports stale and missing generated files", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "icon-assets-"));
    try {
      await createApplicationManifests(temporaryRoot);
      await generateIconAssets(temporaryRoot);
      await writeFile(resolve(temporaryRoot, "apps/readme/app/icon.svg"), "stale\n", "utf8");
      await unlink(resolve(temporaryRoot, "apps/immersive-translate/public/icon/16.png"));

      const differences = await checkIconAssets(temporaryRoot);
      expect(differences).toHaveLength(2);
      expect(differences).toEqual(
        expect.arrayContaining([
          {
            path: "apps/readme/app/icon.svg",
            reason: "SVG does not match the canonical source",
          },
          {
            path: "apps/immersive-translate/public/icon/16.png",
            reason: "file is missing",
          },
        ]),
      );
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });

  it("reports workspace apps without an icon target", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "icon-apps-"));
    try {
      await createApplicationManifests(temporaryRoot);
      const unmappedRoot = resolve(temporaryRoot, "apps/unmapped");
      await mkdir(unmappedRoot, { recursive: true });
      await writeFile(resolve(unmappedRoot, "package.json"), "{}\n", "utf8");
      await generateIconAssets(temporaryRoot);

      expect(await checkIconAssets(temporaryRoot)).toContainEqual({
        path: "apps/unmapped/package.json",
        reason: "app has no registered icon target",
      });
    } finally {
      await rm(temporaryRoot, { force: true, recursive: true });
    }
  });
});
