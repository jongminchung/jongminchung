import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../generated/content-manifest.json";
import { checkGeneratedFiles } from "./build-content";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("documentation content contract", () => {
  it("keeps one Korean and English document for every ID", () => {
    const localesById = new Map<string, Set<string>>();
    for (const document of manifest) {
      const locales = localesById.get(document.id) ?? new Set<string>();
      locales.add(document.locale);
      localesById.set(document.id, locales);
    }
    expect(manifest).toHaveLength(22);
    for (const locales of localesById.values()) expect([...locales].sort()).toEqual(["en", "ko"]);
  });

  it("validates schema, URLs, order, links, search output, and package API coverage", () => {
    const output = execFileSync(
      process.execPath,
      [resolve(appRoot, "scripts/build-content.ts"), "--check"],
      {
        cwd: resolve(appRoot, "../.."),
        encoding: "utf8",
      },
    );
    expect(output).toContain("Validated 22 localized documents.");
  });

  it("rejects stale generated documentation data", async () => {
    const readStaleFile = (): Promise<string> => Promise.resolve("stale\n");
    await expect(
      checkGeneratedFiles(
        [
          {
            filePath: resolve(appRoot, "generated/content-manifest.json"),
            contents: "current\n",
          },
        ],
        readStaleFile,
      ),
    ).rejects.toThrow(/content-manifest\.json.*content:build/su);
  });
});
