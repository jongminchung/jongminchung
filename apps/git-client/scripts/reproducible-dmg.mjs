import { cp, lstat, mkdir, mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { executeCommand } from "./process.mjs";

const require = createRequire(import.meta.url);
const DSStore = require("ds-store");

const HFS_SIGNATURE = 0x482b;
const HFS_HEADER_OFFSET = 1_024;
const HFS_CATALOG_FORK_OFFSET = 272;
const HFS_FORK_EXTENTS_OFFSET = 16;
const HFS_EXTENT_COUNT = 8;
const HFS_EXTENT_BYTES = 8;
const HFS_FIXED_TIMESTAMP = Math.floor(Date.UTC(2020, 0, 1, 0, 0, 0) / 1_000) + 2_082_844_800;
const HFS_FIXED_UUID = Buffer.from("676974636c69656e", "hex");
const UDIF_FIXED_UUID = Buffer.from("676974636c69656e742d646d672d7631", "hex");
const UDIF_TRAILER_BYTES = 512;
const UDIF_UUID_OFFSET = 64;
const HFS_HEADER_DATE_OFFSETS = Object.freeze([16, 20, 24, 28]);
const HFS_CATALOG_DATE_OFFSETS = Object.freeze([12, 16, 20, 24, 28]);

function boundedInteger(value, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return value;
}

function assertRange(buffer, offset, length, label) {
  boundedInteger(offset, `${label} offset`, buffer.length);
  boundedInteger(length, `${label} length`, buffer.length);
  if (offset + length > buffer.length) {
    throw new Error(`${label} exceeds the HFS image boundary`);
  }
}

function normalizeVolumeHeader(image, offset) {
  assertRange(image, offset, 512, "HFS volume header");
  if (image.readUInt16BE(offset) !== HFS_SIGNATURE) {
    throw new Error(`Missing HFS+ volume header at byte ${offset}`);
  }
  for (const dateOffset of HFS_HEADER_DATE_OFFSETS) {
    image.writeUInt32BE(HFS_FIXED_TIMESTAMP, offset + dateOffset);
  }
  HFS_FIXED_UUID.copy(image, offset + 104);
}

function readCatalog(image, volumeHeaderOffset) {
  const allocationBlockSize = boundedInteger(
    image.readUInt32BE(volumeHeaderOffset + 40),
    "HFS allocation block size",
    image.length,
  );
  if (allocationBlockSize < 512 || allocationBlockSize % 512 !== 0) {
    throw new Error(`Invalid HFS allocation block size: ${allocationBlockSize}`);
  }

  const forkOffset = volumeHeaderOffset + HFS_CATALOG_FORK_OFFSET;
  const logicalSizeBigInt = image.readBigUInt64BE(forkOffset);
  if (logicalSizeBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("HFS catalog exceeds the safe JavaScript buffer size");
  }
  const logicalSize = boundedInteger(
    Number(logicalSizeBigInt),
    "HFS catalog logical size",
    image.length,
  );
  const catalog = Buffer.alloc(logicalSize);
  const extents = [];
  let catalogOffset = 0;

  for (let index = 0; index < HFS_EXTENT_COUNT && catalogOffset < logicalSize; index += 1) {
    const extentOffset = forkOffset + HFS_FORK_EXTENTS_OFFSET + index * HFS_EXTENT_BYTES;
    const startBlock = image.readUInt32BE(extentOffset);
    const blockCount = image.readUInt32BE(extentOffset + 4);
    if (blockCount === 0) continue;
    const imageOffset = boundedInteger(
      startBlock * allocationBlockSize,
      "HFS catalog extent offset",
      image.length,
    );
    const extentBytes = boundedInteger(
      blockCount * allocationBlockSize,
      "HFS catalog extent length",
      image.length,
    );
    const length = Math.min(extentBytes, logicalSize - catalogOffset);
    assertRange(image, imageOffset, length, "HFS catalog extent");
    image.copy(catalog, catalogOffset, imageOffset, imageOffset + length);
    extents.push(Object.freeze({ catalogOffset, imageOffset, length }));
    catalogOffset += length;
  }
  if (catalogOffset !== logicalSize) {
    throw new Error("HFS catalog fork is fragmented beyond its inline extents");
  }
  return Object.freeze({ catalog, extents });
}

function normalizeCatalog(catalog) {
  assertRange(catalog, 0, 40, "HFS catalog header node");
  const nodeSize = boundedInteger(catalog.readUInt16BE(32), "HFS catalog node size", 65_536);
  const totalNodes = boundedInteger(
    catalog.readUInt32BE(36),
    "HFS catalog node count",
    catalog.length,
  );
  if (nodeSize < 512 || nodeSize % 512 !== 0 || totalNodes * nodeSize > catalog.length) {
    throw new Error("Invalid HFS catalog B-tree geometry");
  }

  let normalizedRecords = 0;
  for (let nodeIndex = 0; nodeIndex < totalNodes; nodeIndex += 1) {
    const nodeOffset = nodeIndex * nodeSize;
    const kind = catalog.readInt8(nodeOffset + 8);
    if (kind !== -1) continue;
    const recordCount = boundedInteger(
      catalog.readUInt16BE(nodeOffset + 10),
      "HFS catalog leaf record count",
      nodeSize / 2,
    );
    for (let recordIndex = 0; recordIndex < recordCount; recordIndex += 1) {
      const tableOffset = nodeOffset + nodeSize - (recordIndex + 1) * 2;
      const recordOffset = catalog.readUInt16BE(tableOffset);
      if (recordOffset < 14 || recordOffset >= nodeSize) {
        throw new Error("Invalid HFS catalog record offset");
      }
      const absoluteRecordOffset = nodeOffset + recordOffset;
      const keyLength = catalog.readUInt16BE(absoluteRecordOffset);
      let dataOffset = absoluteRecordOffset + 2 + keyLength;
      if (dataOffset % 2 !== 0) dataOffset += 1;
      assertRange(catalog, dataOffset, 48, "HFS catalog record");
      const recordType = catalog.readInt16BE(dataOffset);
      if (recordType !== 1 && recordType !== 2) continue;
      for (const dateOffset of HFS_CATALOG_DATE_OFFSETS) {
        catalog.writeUInt32BE(HFS_FIXED_TIMESTAMP, dataOffset + dateOffset);
      }
      catalog.writeUInt32BE(0, dataOffset + 32);
      catalog.writeUInt32BE(0, dataOffset + 36);
      catalog.writeUInt32BE(0, dataOffset + 68);
      normalizedRecords += 1;
    }
  }
  return normalizedRecords;
}

function writeCatalog(image, catalog, extents) {
  for (const extent of extents) {
    catalog.copy(
      image,
      extent.imageOffset,
      extent.catalogOffset,
      extent.catalogOffset + extent.length,
    );
  }
}

export function normalizeHfsImageBuffer(image) {
  if (!Buffer.isBuffer(image) || image.length < 4_096) {
    throw new Error("Expected a complete uncompressed HFS+ disk image buffer");
  }
  const alternateHeaderOffset = image.length - HFS_HEADER_OFFSET;
  normalizeVolumeHeader(image, HFS_HEADER_OFFSET);
  normalizeVolumeHeader(image, alternateHeaderOffset);
  const { catalog, extents } = readCatalog(image, HFS_HEADER_OFFSET);
  const normalizedRecords = normalizeCatalog(catalog);
  writeCatalog(image, catalog, extents);
  return Object.freeze({
    catalogBytes: catalog.length,
    normalizedRecords,
    timestamp: HFS_FIXED_TIMESTAMP,
    uuid: HFS_FIXED_UUID.toString("hex"),
  });
}

export async function normalizeHfsImage(filePath) {
  const image = await readFile(filePath);
  const report = normalizeHfsImageBuffer(image);
  await writeFile(filePath, image);
  return report;
}

export function normalizeUdifTrailerBuffer(trailer) {
  if (!Buffer.isBuffer(trailer) || trailer.length !== UDIF_TRAILER_BYTES) {
    throw new Error("Expected a complete 512-byte UDIF trailer");
  }
  if (trailer.subarray(0, 4).toString("ascii") !== "koly") {
    throw new Error("Missing UDIF koly trailer signature");
  }
  UDIF_FIXED_UUID.copy(trailer, UDIF_UUID_OFFSET);
  return Object.freeze({ uuid: UDIF_FIXED_UUID.toString("hex") });
}

export async function normalizeUdifImage(filePath) {
  const image = await readFile(filePath);
  if (image.length < UDIF_TRAILER_BYTES) throw new Error("UDIF image is truncated");
  const report = normalizeUdifTrailerBuffer(image.subarray(image.length - UDIF_TRAILER_BYTES));
  await writeFile(filePath, image);
  return report;
}

function writeFinderLayout(path) {
  return new Promise((resolve, reject) => {
    const store = new DSStore();
    store.vSrn(1);
    store.setIconSize(80);
    store.setBackgroundColor(0.12, 0.13, 0.15);
    store.setWindowPos(100, 100);
    store.setWindowSize(640, 480);
    store.setIconPos("Git Client.app", 192, 344);
    store.setIconPos("Applications", 448, 344);
    store.write(path, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function createReproducibleDmg(
  appPath,
  targetPath,
  { runCommand = executeCommand, temporaryDirectory = tmpdir() } = {},
) {
  const appStats = await lstat(appPath);
  if (!appStats.isDirectory() || appStats.isSymbolicLink()) {
    throw new Error(`Reproducible DMG input must be an app directory: ${appPath}`);
  }
  if (basename(appPath) !== "Git Client.app") {
    throw new Error(`Unexpected app bundle name: ${basename(appPath)}`);
  }

  const workingDirectory = await mkdtemp(join(temporaryDirectory, "git-client-dmg-"));
  const sourceDirectory = join(workingDirectory, "source");
  const rawImage = join(workingDirectory, "Git Client.raw.dmg");
  try {
    await mkdir(sourceDirectory);
    await Promise.all([
      cp(appPath, join(sourceDirectory, "Git Client.app"), {
        dereference: false,
        preserveTimestamps: true,
        recursive: true,
        verbatimSymlinks: true,
      }),
      symlink("/Applications", join(sourceDirectory, "Applications")),
    ]);
    await writeFinderLayout(join(sourceDirectory, ".DS_Store"));
    await runCommand("/usr/bin/xattr", ["-cr", sourceDirectory], { capture: true });
    await runCommand(
      "/usr/bin/hdiutil",
      [
        "create",
        "-srcfolder",
        sourceDirectory,
        "-format",
        "UDRW",
        "-fs",
        "HFS+",
        "-layout",
        "NONE",
        "-volname",
        "Git Client",
        "-nospotlight",
        "-srcowners",
        "off",
        "-ov",
        rawImage,
      ],
      { capture: true },
    );
    const normalization = await normalizeHfsImage(rawImage);
    await mkdir(dirname(targetPath), { recursive: true });
    await rm(targetPath, { force: true });
    await runCommand(
      "/usr/bin/hdiutil",
      ["convert", rawImage, "-format", "ULFO", "-ov", "-o", targetPath],
      { capture: true },
    );
    const udif = await normalizeUdifImage(targetPath);
    const targetStats = await stat(targetPath);
    if (!targetStats.isFile()) {
      throw new Error(`hdiutil did not create a regular DMG: ${targetPath}`);
    }
    return Object.freeze({
      bytes: targetStats.size,
      normalization,
      target: targetPath,
      udif,
    });
  } finally {
    await rm(workingDirectory, { force: true, recursive: true });
  }
}
