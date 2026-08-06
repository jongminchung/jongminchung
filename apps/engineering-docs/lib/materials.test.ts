import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ManifestEntry {
  readonly id: string;
  readonly name: string;
  readonly renderer: "svg-motion" | "dom-motion" | "canvas" | "wasm";
  readonly topic: string;
}

const appRoot = resolve(import.meta.dirname, "..");

async function readManifest(): Promise<readonly ManifestEntry[]> {
  return JSON.parse(
    await readFile(resolve(appRoot, "generated/materials-manifest.json"), "utf8"),
  ) as readonly ManifestEntry[];
}

describe("material registry", () => {
  it("contains 24 topics and 179 unique public demos", async () => {
    const manifest = await readManifest();
    expect(manifest).toHaveLength(179);
    expect(new Set(manifest.map((entry) => entry.id)).size).toBe(179);
    expect(new Set(manifest.map((entry) => entry.topic)).size).toBe(24);
  });

  it("limits native rendering to the measured pixel and WASM exceptions", async () => {
    const manifest = await readManifest();
    expect(
      manifest
        .filter((entry) => entry.renderer === "canvas" || entry.renderer === "wasm")
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([
      "building-nes-emulator/CpuStepDemo",
      "building-nes-emulator/NesDemo",
      "building-nes-emulator/SnakeDemo",
      "building-nes-emulator/TileDemo",
      "the-expensive-main-thread/DynamicPriorityDemo",
      "the-expensive-main-thread/SeamCarvingDemo",
    ]);
  });

  it("references every demo from both localized topic documents", async () => {
    const manifest = await readManifest();
    const topics = await readdir(resolve(appRoot, "content/ko/deep-dive"));
    expect(topics).toEqual(expect.arrayContaining(manifest.map((entry) => `${entry.topic}.mdx`)));

    for (const entry of manifest) {
      const [korean, english] = await Promise.all(
        (["ko", "en"] as const).map((locale) =>
          readFile(resolve(appRoot, `content/${locale}/deep-dive/${entry.topic}.mdx`), "utf8"),
        ),
      );
      expect(korean).toContain(`<MaterialDemo id="${entry.id}" />`);
      expect(english).toContain(`<MaterialDemo id="${entry.id}" />`);
    }
  });
});
