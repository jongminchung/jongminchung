import { describe, expect, it } from "vitest";
import { normalizeHfsImageBuffer, normalizeUdifTrailerBuffer } from "./reproducible-dmg.mjs";

const IMAGE_BYTES = 16_384;
const NODE_SIZE = 512;
const CATALOG_OFFSET = 4_096;
const FIXED_HFS_TIMESTAMP = 3_660_681_600;

function writeHeader(image: Buffer, offset: number): void {
  image.writeUInt16BE(0x482b, offset);
  image.writeUInt32BE(4_096, offset + 40);
  image.writeBigUInt64BE(BigInt(NODE_SIZE * 2), offset + 272);
  image.writeUInt32BE(1, offset + 272 + 16);
  image.writeUInt32BE(1, offset + 272 + 20);
}

function writeCatalogRecord(
  catalog: Buffer,
  nodeOffset: number,
  recordOffset: number,
  recordType: 1 | 2,
): void {
  catalog.writeUInt16BE(6, nodeOffset + recordOffset);
  catalog.writeUInt32BE(2, nodeOffset + recordOffset + 2);
  catalog.writeUInt16BE(0, nodeOffset + recordOffset + 6);
  const dataOffset = nodeOffset + recordOffset + 8;
  catalog.writeInt16BE(recordType, dataOffset);
  for (const offset of [12, 16, 20, 24, 28]) {
    catalog.writeUInt32BE(0xdeadbeef, dataOffset + offset);
  }
  catalog.writeUInt32BE(501, dataOffset + 32);
  catalog.writeUInt32BE(20, dataOffset + 36);
  catalog.writeUInt32BE(0x6a5c3b9a, dataOffset + 68);
}

function fixture(): Buffer {
  const image = Buffer.alloc(IMAGE_BYTES);
  writeHeader(image, 1_024);
  writeHeader(image, IMAGE_BYTES - 1_024);
  const catalog = image.subarray(CATALOG_OFFSET, CATALOG_OFFSET + NODE_SIZE * 2);
  catalog.writeInt8(1, 8);
  catalog.writeUInt16BE(NODE_SIZE, 32);
  catalog.writeUInt32BE(2, 36);
  const leaf = NODE_SIZE;
  catalog.writeInt8(-1, leaf + 8);
  catalog.writeUInt16BE(2, leaf + 10);
  writeCatalogRecord(catalog, leaf, 14, 1);
  writeCatalogRecord(catalog, leaf, 80, 2);
  catalog.writeUInt16BE(14, leaf + NODE_SIZE - 2);
  catalog.writeUInt16BE(80, leaf + NODE_SIZE - 4);
  return image;
}

describe("reproducible HFS+ image normalization", () => {
  it("fixes both volume headers and every file/folder catalog record", () => {
    const image = fixture();
    const report = normalizeHfsImageBuffer(image);

    expect(report).toEqual({
      catalogBytes: NODE_SIZE * 2,
      normalizedRecords: 2,
      timestamp: FIXED_HFS_TIMESTAMP,
      uuid: "676974636c69656e",
    });
    for (const header of [1_024, IMAGE_BYTES - 1_024]) {
      expect(image.readUInt32BE(header + 16)).toBe(FIXED_HFS_TIMESTAMP);
      expect(image.subarray(header + 104, header + 112).toString("hex")).toBe("676974636c69656e");
    }
    for (const dataOffset of [CATALOG_OFFSET + NODE_SIZE + 22, CATALOG_OFFSET + NODE_SIZE + 88]) {
      for (const offset of [12, 16, 20, 24, 28]) {
        expect(image.readUInt32BE(dataOffset + offset)).toBe(FIXED_HFS_TIMESTAMP);
      }
      expect(image.readUInt32BE(dataOffset + 32)).toBe(0);
      expect(image.readUInt32BE(dataOffset + 36)).toBe(0);
      expect(image.readUInt32BE(dataOffset + 68)).toBe(0);
    }
  });

  it("fails closed for malformed HFS geometry", () => {
    const image = fixture();
    image.writeUInt32BE(123, 1_024 + 40);
    expect(() => normalizeHfsImageBuffer(image)).toThrow(/allocation block size/u);
  });
});

describe("reproducible UDIF normalization", () => {
  it("fixes the container UUID without changing the payload metadata", () => {
    const trailer = Buffer.alloc(512, 0xa5);
    trailer.write("koly", 0, "ascii");
    const prefix = Buffer.from(trailer.subarray(0, 64));

    expect(normalizeUdifTrailerBuffer(trailer)).toEqual({
      uuid: "676974636c69656e742d646d672d7631",
    });
    expect(trailer.subarray(0, 64)).toEqual(prefix);
    expect(trailer.subarray(64, 80).toString("hex")).toBe("676974636c69656e742d646d672d7631");
  });

  it("rejects a container without the UDIF trailer signature", () => {
    expect(() => normalizeUdifTrailerBuffer(Buffer.alloc(512))).toThrow(/koly/u);
  });
});
