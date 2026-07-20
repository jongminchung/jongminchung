import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { link, open, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import {
  MAXIMUM_MASKED_FRACTION,
  MAXIMUM_MISMATCH_PERCENT,
  MAXIMUM_PNG_FILE_BYTES,
  MINIMUM_STRUCTURAL_SSIM,
  compareVisuals,
} from "./visual-compare.mjs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

const testRoots = [];
const harnessPath = fileURLToPath(new URL("./visual-compare.mjs", import.meta.url));

function crc32(chunks) {
  let value = 0xffffffff;
  for (const chunk of chunks) {
    for (const byte of chunk) {
      value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.allocUnsafe(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32([typeBytes, data]), 8 + data.length);
  return chunk;
}

function encodeRgbaPng(width, height, pixel) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    rows[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = pixel(x, y);
      const offset = row + 1 + x * 4;
      rows[offset] = red;
      rows[offset + 1] = green;
      rows[offset + 2] = blue;
      rows[offset + 3] = alpha;
    }
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeGrayscalePng(width, height, pixel) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 0;
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width + 1);
    rows[row] = 0;
    for (let x = 0; x < width; x += 1) rows[row + 1 + x] = pixel(x, y);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "git-client-visual-parity-"));
  testRoots.push(root);
  return root;
}

async function writeImages(root, reference, candidate, width = 32, height = 32) {
  await Promise.all([
    writeFile(join(root, "reference.png"), encodeRgbaPng(width, height, reference)),
    writeFile(join(root, "candidate.png"), encodeRgbaPng(width, height, candidate)),
  ]);
}

function options(root, outputPath = "report.json") {
  return {
    parityRoot: root,
    referencePath: "reference.png",
    candidatePath: "candidate.png",
    outputPath,
  };
}

after(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

void describe("visual parity comparison", () => {
  void it("writes a deterministic passing report for equal normalized pixels", async () => {
    const root = await fixture();
    const same = (x, y) => [x * 3, y * 5, (x + y) * 2, 255];
    await writeImages(root, same, same);

    const first = await compareVisuals({
      ...options(root),
      metadata: {
        z: "last",
        a: { scale: 2, theme: "Darcula" },
      },
    });
    const firstBytes = await readFile(join(root, "report.json"));
    const second = await compareVisuals({
      ...options(root),
      metadata: {
        a: { theme: "Darcula", scale: 2 },
        z: "last",
      },
    });
    const secondBytes = await readFile(join(root, "report.json"));

    assert.deepEqual(first, second);
    assert.deepEqual(firstBytes, secondBytes);
    assert.equal(first.pass, true);
    assert.deepEqual(first.failures, []);
    assert.equal(first.metrics.structuralSsim, 1);
    assert.equal(first.metrics.mismatchPercent, 0);
    assert.equal(first.geometry.equalNormalizedDimensions, true);
    assert.deepEqual(first.geometry.normalized, { height: 32, width: 32 });
    assert.equal(first.thresholds.minimumStructuralSsim, MINIMUM_STRUCTURAL_SSIM);
    assert.equal(first.thresholds.maximumMismatchPercent, MAXIMUM_MISMATCH_PERCENT);
    assert.match(first.inputs.reference.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(firstBytes.at(-1), 0x0a);
    assert.equal(
      (await readdir(root)).some((name) => name.endsWith(".tmp")),
      false,
    );
  });

  void it("fails both structural and exact-pixel thresholds without hiding the report", async () => {
    const root = await fixture();
    await writeImages(
      root,
      () => [0, 0, 0, 255],
      () => [255, 255, 255, 255],
    );

    const report = await compareVisuals(options(root));

    assert.equal(report.pass, false);
    assert.deepEqual(report.failures, ["structuralSsimBelowMinimum", "pixelMismatchAboveMaximum"]);
    assert.equal(report.metrics.mismatchPercent, 100);
    assert.ok(report.metrics.structuralSsim < MINIMUM_STRUCTURAL_SSIM);
    assert.equal(JSON.parse(await readFile(join(root, "report.json"), "utf8")).pass, false);
  });

  void it("applies only an explicitly reviewed PNG and rectangle mask", async () => {
    const root = await fixture();
    await writeImages(
      root,
      () => [20, 30, 40, 255],
      (x, y) =>
        x < 8 && y < 8
          ? [240, 250, 255, 255]
          : x === 9 && y === 9
            ? [255, 0, 0, 255]
            : [20, 30, 40, 255],
    );
    await writeFile(
      join(root, "mask.png"),
      encodeGrayscalePng(32, 32, (x, y) => (x === 9 && y === 9 ? 255 : 0)),
    );
    await writeFile(
      join(root, "rectangles.json"),
      JSON.stringify([{ x: 0, y: 0, width: 8, height: 8 }]),
    );
    await writeFile(
      join(root, "review.json"),
      JSON.stringify({
        reason: "Reviewed glyph edge antialiasing only",
        reviewed: true,
        reviewer: "Parity reviewer",
      }),
    );

    const report = await compareVisuals({
      ...options(root),
      maskPath: "mask.png",
      maskRectanglesPath: "rectangles.json",
      maskReviewPath: "review.json",
    });

    assert.equal(report.pass, true);
    assert.equal(report.metrics.structuralSsim, 1);
    assert.equal(report.metrics.mismatchPercent, 0);
    assert.equal(report.mask.maskedPixels, 65);
    assert.equal(report.mask.review.reviewed, true);
    assert.equal(report.mask.png, true);
    assert.equal(report.inputs.mask.path, "mask.png");
  });

  void it("rejects unreviewed, out-of-bounds, dimension-mismatched, and excessive masks", async () => {
    const root = await fixture();
    await writeImages(
      root,
      () => [0, 0, 0, 255],
      () => [0, 0, 0, 255],
    );
    await writeFile(
      join(root, "mask.png"),
      encodeGrayscalePng(16, 16, () => 255),
    );

    await assert.rejects(
      compareVisuals({ ...options(root), maskRectangles: [{ x: 0, y: 0, width: 1, height: 1 }] }),
      /requires review metadata/u,
    );
    await assert.rejects(
      compareVisuals({
        ...options(root),
        maskPath: "mask.png",
        maskReview: { reviewed: true, reviewer: "R", reason: "text edge" },
      }),
      /dimensions must match/u,
    );
    await assert.rejects(
      compareVisuals({
        ...options(root),
        maskRectangles: [{ x: 31, y: 31, width: 2, height: 2 }],
        maskReview: { reviewed: true, reviewer: "R", reason: "text edge" },
      }),
      /outside normalized image bounds/u,
    );
    const excessiveWidth = Math.floor(32 * MAXIMUM_MASKED_FRACTION) + 1;
    await assert.rejects(
      compareVisuals({
        ...options(root),
        maskRectangles: [{ x: 0, y: 0, width: excessiveWidth, height: 32 }],
        maskReview: { reviewed: true, reviewer: "R", reason: "text edge" },
      }),
      /excludes more than/u,
    );
    assert.equal(await readFile(join(root, "reference.png")).then(() => true), true);
  });

  void it("rejects unequal normalized dimensions before writing a report", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "reference.png"),
      encodeRgbaPng(10, 10, () => [0, 0, 0, 255]),
    );
    await writeFile(
      join(root, "candidate.png"),
      encodeRgbaPng(11, 10, () => [0, 0, 0, 255]),
    );

    await assert.rejects(compareVisuals(options(root)), /dimensions differ/u);
    await assert.rejects(readFile(join(root, "report.json")), /ENOENT/u);
  });

  void it("rejects traversal, symlinks, input overwrite, and input hard-link reuse", async () => {
    const root = await fixture();
    const outside = await fixture();
    const same = () => [0, 0, 0, 255];
    await writeImages(root, same, same);
    await writeFile(join(outside, "outside.png"), encodeRgbaPng(32, 32, same));
    await symlink(join(outside, "outside.png"), join(root, "linked.png"));
    await writeFile(join(outside, "outside-report.json"), "preserved", "utf8");
    await symlink(join(outside, "outside-report.json"), join(root, "linked-report.json"));

    await assert.rejects(
      compareVisuals({ ...options(root), referencePath: "linked.png" }),
      /symbolic links/u,
    );
    await assert.rejects(
      compareVisuals({ ...options(root), referencePath: "../outside.png" }),
      /inside the parity root/u,
    );
    const before = await readFile(join(root, "reference.png"));
    await assert.rejects(
      compareVisuals({ ...options(root), outputPath: "reference.png" }),
      /must not overwrite an input/u,
    );
    assert.deepEqual(await readFile(join(root, "reference.png")), before);
    await assert.rejects(
      compareVisuals({ ...options(root), outputPath: "linked-report.json" }),
      /symbolic link/u,
    );
    assert.equal(await readFile(join(outside, "outside-report.json"), "utf8"), "preserved");
    await link(join(root, "reference.png"), join(root, "hard-linked.png"));
    await assert.rejects(
      compareVisuals({ ...options(root), candidatePath: "hard-linked.png" }),
      /must be distinct/u,
    );
    await link(join(root, "reference.png"), join(root, "hard-linked-report.json"));
    await assert.rejects(
      compareVisuals({ ...options(root), outputPath: "hard-linked-report.json" }),
      /input hard link/u,
    );
  });

  void it("rejects oversized and malformed PNG inputs without package dependencies", async () => {
    const root = await fixture();
    const same = () => [0, 0, 0, 255];
    await writeImages(root, same, same);
    const malformed = Buffer.from(await readFile(join(root, "candidate.png")));
    malformed[malformed.length - 1] ^= 0xff;
    await writeFile(join(root, "candidate.png"), malformed);
    await assert.rejects(compareVisuals(options(root)), /invalid CRC/u);

    const handle = await open(join(root, "candidate.png"), "w");
    await handle.truncate(MAXIMUM_PNG_FILE_BYTES + 1);
    await handle.close();
    await assert.rejects(compareVisuals(options(root)), /exceeds/u);
  });

  void it("normalizes transparent RGB bytes over white before comparison", async () => {
    const root = await fixture();
    await writeImages(
      root,
      () => [255, 0, 0, 0],
      () => [0, 0, 255, 0],
    );

    const report = await compareVisuals(options(root));
    assert.equal(report.pass, true);
    assert.equal(report.metrics.mismatchPercent, 0);
    assert.equal(report.metrics.structuralSsim, 1);
  });

  void it("returns CLI status 1 for threshold failure and status 2 for malformed input", async () => {
    const root = await fixture();
    await writeImages(
      root,
      () => [0, 0, 0, 255],
      () => [255, 255, 255, 255],
    );
    const failing = spawnSync(
      process.execPath,
      [
        harnessPath,
        "--root",
        root,
        "--reference",
        "reference.png",
        "--candidate",
        "candidate.png",
        "--output",
        "cli-report.json",
      ],
      { encoding: "utf8" },
    );
    assert.equal(failing.status, 1, failing.stderr);
    assert.deepEqual(JSON.parse(failing.stdout), {
      pass: false,
      report: "cli-report.json",
    });
    assert.equal(JSON.parse(await readFile(join(root, "cli-report.json"), "utf8")).pass, false);

    const malformed = spawnSync(
      process.execPath,
      [
        harnessPath,
        "--root",
        root,
        "--reference",
        "missing.png",
        "--candidate",
        "candidate.png",
        "--output",
        "missing-report.json",
      ],
      { encoding: "utf8" },
    );
    assert.equal(malformed.status, 2);
    assert.match(malformed.stderr, /^io:/u);
  });
});
