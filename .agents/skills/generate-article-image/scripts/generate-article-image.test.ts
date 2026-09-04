import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import {
  analyzeEditorialStyle,
  finalizeImage,
  parseReferenceArguments,
} from "./generate-article-image.ts";

let temporaryDirectory: string;

async function createImage(filename: string, color: string): Promise<string> {
  const path = join(temporaryDirectory, filename);
  await sharp({
    create: {
      background: color,
      channels: 3,
      height: 128,
      width: 192,
    },
  })
    .png()
    .toFile(path);
  return path;
}

beforeAll(async () => {
  temporaryDirectory = await mkdtemp(
    join(tmpdir(), "generate-article-image-test-"),
  );
});

afterAll(async () => {
  await rm(temporaryDirectory, { force: true, recursive: true });
});

describe("parseReferenceArguments", () => {
  test("accepts one distinct image for every required role", () => {
    expect(
      parseReferenceArguments([
        "composition=composition.png",
        "palette=palette.png",
        "material=material.webp",
      ]),
    ).toEqual([
      { filename: "composition.png", role: "composition" },
      { filename: "palette.png", role: "palette" },
      { filename: "material.webp", role: "material" },
    ]);
  });

  test("rejects an unlabeled reference", () => {
    expect(() =>
      parseReferenceArguments([
        "composition.png",
        "palette=palette.png",
        "material=material.png",
      ]),
    ).toThrow("Use --reference <role>=<filename>");
  });

  test("rejects a missing required role", () => {
    expect(() =>
      parseReferenceArguments([
        "composition=composition.png",
        "palette=palette.png",
        "motion=motion.png",
      ]),
    ).toThrow("Missing required reference role: material");
  });
});

describe("analyzeEditorialStyle", () => {
  test("rejects a near-black candidate against bright chromatic references", async () => {
    const references = await Promise.all([
      createImage("composition.png", "#8f7bd9"),
      createImage("palette.png", "#69bfc0"),
      createImage("material.png", "#dc849e"),
    ]);
    const candidate = await createImage("dark.png", "#030617");
    const analysis = await analyzeEditorialStyle(candidate, [
      {
        filename: "composition.png",
        path: references[0] ?? "",
        role: "composition",
      },
      {
        filename: "palette.png",
        path: references[1] ?? "",
        role: "palette",
      },
      {
        filename: "material.png",
        path: references[2] ?? "",
        role: "material",
      },
    ]);

    expect(analysis.ok).toBe(false);
    expect(
      analysis.checks.find(({ id }) => id === "dark-pixel-ratio")?.passed,
    ).toBe(false);
    expect(
      analysis.checks.find(({ id }) => id === "edge-luminance")?.passed,
    ).toBe(false);
  });

  test("accepts a bright chromatic candidate in the reference range", async () => {
    const references = await Promise.all([
      createImage("bright-composition.png", "#8f7bd9"),
      createImage("bright-palette.png", "#69bfc0"),
      createImage("bright-material.png", "#dc849e"),
    ]);
    const candidate = await createImage("bright.png", "#7e8ed8");
    const analysis = await analyzeEditorialStyle(candidate, [
      {
        filename: "bright-composition.png",
        path: references[0] ?? "",
        role: "composition",
      },
      {
        filename: "bright-palette.png",
        path: references[1] ?? "",
        role: "palette",
      },
      {
        filename: "bright-material.png",
        path: references[2] ?? "",
        role: "material",
      },
    ]);

    expect(analysis.ok).toBe(true);
  });

  test("prevents finalize from writing a tone-incompatible candidate", async () => {
    const references = await Promise.all([
      createImage("finalize-composition.png", "#8f7bd9"),
      createImage("finalize-palette.png", "#69bfc0"),
      createImage("finalize-material.png", "#dc849e"),
    ]);
    const candidate = await createImage("finalize-dark.png", "#030617");
    const output = join(temporaryDirectory, "finalize-output.png");

    expect(
      finalizeImage(candidate, output, [
        {
          filename: "finalize-composition.png",
          path: references[0] ?? "",
          role: "composition",
        },
        {
          filename: "finalize-palette.png",
          path: references[1] ?? "",
          role: "palette",
        },
        {
          filename: "finalize-material.png",
          path: references[2] ?? "",
          role: "material",
        },
      ]),
    ).rejects.toThrow("Editorial tone analysis failed");
    expect(await Bun.file(output).exists()).toBe(false);
  });

  test("normalizes an approved candidate to the canonical image contract", async () => {
    const references = await Promise.all([
      createImage("approved-composition.png", "#8f7bd9"),
      createImage("approved-palette.png", "#69bfc0"),
      createImage("approved-material.png", "#dc849e"),
    ]);
    const candidate = await createImage("approved.png", "#7e8ed8");
    const output = join(temporaryDirectory, "approved-output.png");
    const analysis = await finalizeImage(candidate, output, [
      {
        filename: "approved-composition.png",
        path: references[0] ?? "",
        role: "composition",
      },
      {
        filename: "approved-palette.png",
        path: references[1] ?? "",
        role: "palette",
      },
      {
        filename: "approved-material.png",
        path: references[2] ?? "",
        role: "material",
      },
    ]);
    const metadata = await sharp(output).metadata();

    expect(analysis.ok).toBe(true);
    expect(metadata).toMatchObject({
      channels: 3,
      format: "png",
      height: 1024,
      space: "srgb",
      width: 1536,
    });
  });
});
