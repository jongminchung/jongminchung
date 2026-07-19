import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
    lstat,
    open,
    realpath,
    rename,
    unlink,
} from "node:fs/promises";
import {
    basename,
    dirname,
    isAbsolute,
    join,
    relative,
    resolve,
    sep,
} from "node:path";
import { pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

export const MINIMUM_STRUCTURAL_SSIM = 0.995;
export const MAXIMUM_MISMATCH_PERCENT = 0.5;
export const MAXIMUM_PNG_FILE_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_PNG_PIXELS = 20_000_000;
export const MAXIMUM_MASKED_FRACTION = 0.25;

const PNG_SIGNATURE = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const MAXIMUM_DIMENSION = 8_192;
const MAXIMUM_JSON_BYTES = 1024 * 1024;
const MAXIMUM_JSON_DEPTH = 32;
const MAXIMUM_JSON_NODES = 100_000;
const MAXIMUM_MASK_RECTANGLES = 10_000;
const SSIM_WINDOW_SIZE = 8;
const SSIM_C1 = (0.01 * 255) ** 2;
const SSIM_C2 = (0.03 * 255) ** 2;

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    CRC_TABLE[index] = value >>> 0;
}

export class VisualComparisonError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "VisualComparisonError";
        this.code = code;
    }
}

function fail(code, message) {
    throw new VisualComparisonError(code, message);
}

function isErrno(error, code) {
    return error instanceof Error && "code" in error && error.code === code;
}

function safeError(error, fallback) {
    if (error instanceof VisualComparisonError) return error;
    return new VisualComparisonError(
        "io",
        error instanceof Error ? error.message : fallback,
    );
}

function sameIdentity(left, right) {
    return left.dev === right.device && left.ino === right.inode;
}

function identity(metadata) {
    return {
        device: metadata.dev,
        inode: metadata.ino,
        size: metadata.size,
    };
}

function isContained(parent, child) {
    const difference = relative(parent, child);
    return (
        difference === "" ||
        (difference !== ".." &&
            !difference.startsWith(`..${sep}`) &&
            !isAbsolute(difference))
    );
}

function portableRelative(root, path) {
    return relative(root, path).split(sep).join("/");
}

async function pinRoot(untrustedRoot) {
    if (
        typeof untrustedRoot !== "string" ||
        untrustedRoot.length === 0 ||
        untrustedRoot.length > 16_384 ||
        untrustedRoot.includes("\0")
    ) {
        fail("invalidInput", "Parity root must be a non-empty filesystem path");
    }
    const path = resolve(untrustedRoot);
    let before;
    try {
        before = await lstat(path);
    } catch (error) {
        throw safeError(error, "Parity root is not accessible");
    }
    if (before.isSymbolicLink() || !before.isDirectory()) {
        fail("unsafePath", "Parity root must be a real directory, not a symbolic link");
    }
    const canonical = await realpath(path).catch((error) => {
        throw safeError(error, "Parity root is not accessible");
    });
    const after = await lstat(canonical).catch((error) => {
        throw safeError(error, "Parity root is not accessible");
    });
    if (
        after.isSymbolicLink() ||
        !after.isDirectory() ||
        !sameIdentity(after, identity(before))
    ) {
        fail("unsafePath", "Parity root changed while it was being opened");
    }
    return { path: canonical, ...identity(after) };
}

async function assertPinnedDirectory(directory, label) {
    const metadata = await lstat(directory.path).catch((error) => {
        throw safeError(error, `${label} is not accessible`);
    });
    if (
        metadata.isSymbolicLink() ||
        !metadata.isDirectory() ||
        !sameIdentity(metadata, directory)
    ) {
        fail("unsafePath", `${label} changed during the comparison`);
    }
}

function candidatePath(root, untrustedPath, label) {
    if (
        typeof untrustedPath !== "string" ||
        untrustedPath.length === 0 ||
        untrustedPath.length > 16_384 ||
        untrustedPath.includes("\0")
    ) {
        fail("invalidInput", `${label} must be a non-empty filesystem path`);
    }
    const path = isAbsolute(untrustedPath)
        ? resolve(untrustedPath)
        : resolve(root.path, untrustedPath);
    if (!isContained(root.path, path) || path === root.path) {
        fail("unsafePath", `${label} must stay inside the parity root`);
    }
    return path;
}

async function inspectContainedPath(root, path, label, expectedKind) {
    const components = relative(root.path, path).split(sep);
    let current = root.path;
    for (let index = 0; index < components.length; index += 1) {
        current = join(current, components[index]);
        let metadata;
        try {
            metadata = await lstat(current);
        } catch (error) {
            throw safeError(error, `${label} is not accessible`);
        }
        if (metadata.isSymbolicLink()) {
            fail("unsafePath", `${label} must not traverse symbolic links`);
        }
        const final = index === components.length - 1;
        if (!final && !metadata.isDirectory()) {
            fail("unsafePath", `${label} has a non-directory parent`);
        }
        if (final) {
            if (expectedKind === "file" && !metadata.isFile()) {
                fail("unsafePath", `${label} must be a regular file`);
            }
            if (expectedKind === "directory" && !metadata.isDirectory()) {
                fail("unsafePath", `${label} parent must be a directory`);
            }
            const canonical = await realpath(current).catch((error) => {
                throw safeError(error, `${label} is not accessible`);
            });
            if (canonical !== current) {
                fail("unsafePath", `${label} must not traverse symbolic links`);
            }
            return { path: current, ...identity(metadata) };
        }
    }
    fail("unsafePath", `${label} is invalid`);
}

async function resolveInput(root, untrustedPath, label) {
    const path = candidatePath(root, untrustedPath, label);
    return inspectContainedPath(root, path, label, "file");
}

async function resolveOutput(root, untrustedPath) {
    const path = candidatePath(root, untrustedPath, "Output report");
    if (basename(path).length === 0) {
        fail("invalidInput", "Output report must have a filename");
    }
    const parent = await inspectContainedPath(
        root,
        dirname(path),
        "Output report",
        "directory",
    );
    let existing = null;
    try {
        existing = await lstat(path);
    } catch (error) {
        if (!isErrno(error, "ENOENT")) {
            throw safeError(error, "Output report is not accessible");
        }
    }
    if (
        existing !== null &&
        (existing.isSymbolicLink() || !existing.isFile())
    ) {
        fail("unsafePath", "Output report must be a regular file, not a symbolic link");
    }
    return { path, parent, existing: existing === null ? null : identity(existing) };
}

async function readBoundedFile(file, maximumBytes, label) {
    if (file.size > maximumBytes) {
        fail("oversizedInput", `${label} exceeds ${maximumBytes} bytes`);
    }
    let handle;
    try {
        handle = await open(file.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
        throw safeError(error, `${label} cannot be opened safely`);
    }
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || !sameIdentity(opened, file)) {
            fail("unsafePath", `${label} changed before it could be read`);
        }
        const chunks = [];
        let totalBytes = 0;
        while (true) {
            const remaining = maximumBytes - totalBytes + 1;
            const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
            const { bytesRead } = await handle.read(
                chunk,
                0,
                chunk.length,
                null,
            );
            if (bytesRead === 0) break;
            chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
            totalBytes += bytesRead;
            if (totalBytes > maximumBytes) {
                fail("oversizedInput", `${label} exceeds ${maximumBytes} bytes`);
            }
        }
        const after = await lstat(file.path).catch(() => null);
        if (
            after === null ||
            after.isSymbolicLink() ||
            !after.isFile() ||
            !sameIdentity(after, identity(opened))
        ) {
            fail("unsafePath", `${label} changed while it was being read`);
        }
        return Buffer.concat(chunks, totalBytes);
    } finally {
        await handle.close().catch(() => undefined);
    }
}

function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}

function crc32(chunks) {
    let value = 0xffffffff;
    for (const chunk of chunks) {
        for (const byte of chunk) {
            value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
        }
    }
    return (value ^ 0xffffffff) >>> 0;
}

function paeth(left, above, upperLeft) {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
        return left;
    }
    return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function colorLayout(colorType) {
    switch (colorType) {
        case 0:
            return { channels: 1, bytesPerPixel: 1 };
        case 2:
            return { channels: 3, bytesPerPixel: 3 };
        case 3:
            return { channels: 1, bytesPerPixel: 1 };
        case 4:
            return { channels: 2, bytesPerPixel: 2 };
        case 6:
            return { channels: 4, bytesPerPixel: 4 };
        default:
            fail("malformedPng", `Unsupported PNG color type ${colorType}`);
    }
}

function decodeRows(inflated, width, height, bytesPerPixel, rowBytes) {
    const decoded = Buffer.allocUnsafe(rowBytes * height);
    let inputOffset = 0;
    for (let y = 0; y < height; y += 1) {
        const filter = inflated[inputOffset];
        inputOffset += 1;
        if (filter === undefined || filter > 4) {
            fail("malformedPng", `Unsupported PNG row filter ${String(filter)}`);
        }
        const rowOffset = y * rowBytes;
        const previousOffset = rowOffset - rowBytes;
        for (let x = 0; x < rowBytes; x += 1) {
            const raw = inflated[inputOffset + x];
            if (raw === undefined) fail("malformedPng", "PNG scanline is truncated");
            const left = x >= bytesPerPixel ? decoded[rowOffset + x - bytesPerPixel] : 0;
            const above = y > 0 ? decoded[previousOffset + x] : 0;
            const upperLeft =
                y > 0 && x >= bytesPerPixel
                    ? decoded[previousOffset + x - bytesPerPixel]
                    : 0;
            let value;
            switch (filter) {
                case 0:
                    value = raw;
                    break;
                case 1:
                    value = raw + left;
                    break;
                case 2:
                    value = raw + above;
                    break;
                case 3:
                    value = raw + Math.floor((left + above) / 2);
                    break;
                case 4:
                    value = raw + paeth(left, above, upperLeft);
                    break;
                default:
                    fail("malformedPng", "PNG row filter is invalid");
            }
            decoded[rowOffset + x] = value & 0xff;
        }
        inputOffset += rowBytes;
    }
    return decoded;
}

function normalizedRgba(decoded, header, palette, transparency) {
    const { width, height, colorType } = header;
    const rgba = Buffer.allocUnsafe(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
        const target = pixel * 4;
        switch (colorType) {
            case 0: {
                const gray = decoded[pixel];
                rgba[target] = gray;
                rgba[target + 1] = gray;
                rgba[target + 2] = gray;
                const transparentGray =
                    transparency === null ? null : transparency.readUInt16BE(0);
                rgba[target + 3] = transparentGray === gray ? 0 : 255;
                break;
            }
            case 2: {
                const source = pixel * 3;
                const red = decoded[source];
                const green = decoded[source + 1];
                const blue = decoded[source + 2];
                rgba[target] = red;
                rgba[target + 1] = green;
                rgba[target + 2] = blue;
                const transparent =
                    transparency !== null &&
                    transparency.readUInt16BE(0) === red &&
                    transparency.readUInt16BE(2) === green &&
                    transparency.readUInt16BE(4) === blue;
                rgba[target + 3] = transparent ? 0 : 255;
                break;
            }
            case 3: {
                if (palette === null) {
                    fail("malformedPng", "Indexed PNG is missing its palette");
                }
                const paletteIndex = decoded[pixel];
                const source = paletteIndex * 3;
                if (source + 2 >= palette.length) {
                    fail("malformedPng", "Indexed PNG references an invalid palette entry");
                }
                rgba[target] = palette[source];
                rgba[target + 1] = palette[source + 1];
                rgba[target + 2] = palette[source + 2];
                rgba[target + 3] = transparency?.[paletteIndex] ?? 255;
                break;
            }
            case 4: {
                const source = pixel * 2;
                const gray = decoded[source];
                rgba[target] = gray;
                rgba[target + 1] = gray;
                rgba[target + 2] = gray;
                rgba[target + 3] = decoded[source + 1];
                break;
            }
            case 6: {
                const source = pixel * 4;
                rgba[target] = decoded[source];
                rgba[target + 1] = decoded[source + 1];
                rgba[target + 2] = decoded[source + 2];
                rgba[target + 3] = decoded[source + 3];
                break;
            }
            default:
                fail("malformedPng", "PNG color type is invalid");
        }
    }
    return rgba;
}

export function decodePng(bytes, label = "PNG") {
    if (!Buffer.isBuffer(bytes)) fail("invalidInput", `${label} must be a Buffer`);
    if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
        fail("malformedPng", `${label} has an invalid PNG signature`);
    }
    let offset = 8;
    let header = null;
    let palette = null;
    let transparency = null;
    const idat = [];
    let idatBytes = 0;
    let seenIdat = false;
    let idatEnded = false;
    let seenEnd = false;
    while (offset < bytes.length) {
        if (offset + 12 > bytes.length) fail("malformedPng", `${label} has a truncated chunk`);
        const length = bytes.readUInt32BE(offset);
        const typeBytes = bytes.subarray(offset + 4, offset + 8);
        const type = typeBytes.toString("ascii");
        if (!/^[A-Za-z]{4}$/u.test(type) || (typeBytes[2] & 0x20) !== 0) {
            fail("malformedPng", `${label} contains an invalid PNG chunk type`);
        }
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        const crcOffset = dataEnd;
        if (dataEnd > bytes.length - 4) {
            fail("malformedPng", `${label} chunk ${type} is truncated`);
        }
        const data = bytes.subarray(dataStart, dataEnd);
        const expectedCrc = bytes.readUInt32BE(crcOffset);
        if (crc32([typeBytes, data]) !== expectedCrc) {
            fail("malformedPng", `${label} chunk ${type} has an invalid CRC`);
        }
        offset = crcOffset + 4;
        if (seenEnd) fail("malformedPng", `${label} has data after IEND`);
        if (seenIdat && type !== "IDAT") idatEnded = true;
        if (type === "IHDR") {
            if (header !== null || data.length !== 13 || offset !== 33) {
                fail("malformedPng", `${label} has an invalid IHDR chunk`);
            }
            const width = data.readUInt32BE(0);
            const height = data.readUInt32BE(4);
            const bitDepth = data[8];
            const colorType = data[9];
            const compression = data[10];
            const filter = data[11];
            const interlace = data[12];
            if (
                width < 1 ||
                height < 1 ||
                width > MAXIMUM_DIMENSION ||
                height > MAXIMUM_DIMENSION ||
                width * height > MAXIMUM_PNG_PIXELS
            ) {
                fail("oversizedInput", `${label} dimensions exceed the configured limit`);
            }
            if (bitDepth !== 8) {
                fail("malformedPng", `${label} must use 8-bit PNG samples`);
            }
            colorLayout(colorType);
            if (compression !== 0 || filter !== 0 || interlace !== 0) {
                fail(
                    "malformedPng",
                    `${label} uses unsupported compression, filtering, or interlacing`,
                );
            }
            header = { width, height, bitDepth, colorType };
        } else if (type === "PLTE") {
            if (
                header === null ||
                palette !== null ||
                seenIdat ||
                header.colorType === 0 ||
                header.colorType === 4 ||
                data.length < 3 ||
                data.length > 768 ||
                data.length % 3 !== 0
            ) {
                fail("malformedPng", `${label} has an invalid PLTE chunk`);
            }
            palette = Buffer.from(data);
        } else if (type === "tRNS") {
            if (header === null || transparency !== null || seenIdat) {
                fail("malformedPng", `${label} has an invalid tRNS chunk`);
            }
            const validLength =
                (header.colorType === 0 && data.length === 2) ||
                (header.colorType === 2 && data.length === 6) ||
                (header.colorType === 3 &&
                    palette !== null &&
                    data.length <= palette.length / 3);
            if (!validLength) fail("malformedPng", `${label} has an invalid tRNS payload`);
            if (
                (header.colorType === 0 && data.readUInt16BE(0) > 255) ||
                (header.colorType === 2 &&
                    [0, 2, 4].some((offset_) => data.readUInt16BE(offset_) > 255))
            ) {
                fail("malformedPng", `${label} has an out-of-range tRNS sample`);
            }
            transparency = Buffer.from(data);
        } else if (type === "IDAT") {
            if (header === null || idatEnded) {
                fail("malformedPng", `${label} has an invalid IDAT sequence`);
            }
            seenIdat = true;
            idatBytes += data.length;
            if (idatBytes > MAXIMUM_PNG_FILE_BYTES) {
                fail("oversizedInput", `${label} compressed data is too large`);
            }
            idat.push(data);
        } else if (type === "IEND") {
            if (header === null || !seenIdat || data.length !== 0) {
                fail("malformedPng", `${label} has an invalid IEND chunk`);
            }
            seenEnd = true;
            if (offset !== bytes.length) fail("malformedPng", `${label} has data after IEND`);
        } else if (type === "acTL" || type === "fcTL" || type === "fdAT") {
            fail("malformedPng", `${label} must not be an animated PNG`);
        } else if ((typeBytes[0] & 0x20) === 0) {
            fail("malformedPng", `${label} contains unknown critical chunk ${type}`);
        }
    }
    if (header === null || !seenEnd || !seenIdat) {
        fail("malformedPng", `${label} is missing required PNG chunks`);
    }
    if (header.colorType === 3 && palette === null) {
        fail("malformedPng", `${label} indexed pixels require a palette`);
    }
    if ((header.colorType === 4 || header.colorType === 6) && transparency !== null) {
        fail("malformedPng", `${label} alpha PNG must not contain tRNS`);
    }
    const layout = colorLayout(header.colorType);
    const rowBytes = header.width * layout.channels;
    const inflatedBytes = (rowBytes + 1) * header.height;
    let inflated;
    try {
        inflated = inflateSync(Buffer.concat(idat, idatBytes), {
            maxOutputLength: inflatedBytes + 1,
        });
    } catch (error) {
        throw new VisualComparisonError(
            "malformedPng",
            `${label} compressed pixels are invalid: ${error instanceof Error ? error.message : "inflate failed"}`,
        );
    }
    if (inflated.length !== inflatedBytes) {
        fail("malformedPng", `${label} has an invalid decompressed byte count`);
    }
    const decoded = decodeRows(
        inflated,
        header.width,
        header.height,
        layout.bytesPerPixel,
        rowBytes,
    );
    return Object.freeze({
        width: header.width,
        height: header.height,
        rgba: normalizedRgba(decoded, header, palette, transparency),
    });
}

function validateJson(value) {
    let nodes = 0;
    function visit(current, depth) {
        nodes += 1;
        if (nodes > MAXIMUM_JSON_NODES || depth > MAXIMUM_JSON_DEPTH) {
            fail("malformedJson", "JSON metadata exceeds its complexity limit");
        }
        if (
            current === null ||
            typeof current === "string" ||
            typeof current === "boolean"
        ) {
            return current;
        }
        if (typeof current === "number") {
            if (!Number.isFinite(current)) fail("malformedJson", "JSON number must be finite");
            return current;
        }
        if (Array.isArray(current)) return current.map((item) => visit(item, depth + 1));
        if (typeof current === "object") {
            const normalized = Object.create(null);
            for (const key of Object.keys(current).sort()) {
                normalized[key] = visit(current[key], depth + 1);
            }
            return normalized;
        }
        fail("malformedJson", "Metadata must contain only JSON values");
    }
    return visit(value, 0);
}

async function readJsonInput(root, untrustedPath, label) {
    const file = await resolveInput(root, untrustedPath, label);
    const bytes = await readBoundedFile(file, MAXIMUM_JSON_BYTES, label);
    let decoded;
    try {
        decoded = JSON.parse(bytes.toString("utf8"));
    } catch {
        fail("malformedJson", `${label} is not valid JSON`);
    }
    return {
        file,
        bytes,
        value: validateJson(decoded),
    };
}

function validateRectangles(untrusted, width, height) {
    if (!Array.isArray(untrusted) || untrusted.length > MAXIMUM_MASK_RECTANGLES) {
        fail("malformedMask", "Mask rectangles must be a bounded JSON array");
    }
    const rectangles = [];
    let totalArea = 0;
    for (const value of untrusted) {
        if (
            value === null ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            Object.keys(value).some(
                (key) => !["x", "y", "width", "height"].includes(key),
            )
        ) {
            fail("malformedMask", "Every mask rectangle must contain only x, y, width, height");
        }
        const rectangle = {
            x: value.x,
            y: value.y,
            width: value.width,
            height: value.height,
        };
        if (
            !Object.values(rectangle).every(Number.isSafeInteger) ||
            rectangle.x < 0 ||
            rectangle.y < 0 ||
            rectangle.width < 1 ||
            rectangle.height < 1 ||
            rectangle.x + rectangle.width > width ||
            rectangle.y + rectangle.height > height
        ) {
            fail("malformedMask", "Mask rectangle is outside normalized image bounds");
        }
        totalArea += rectangle.width * rectangle.height;
        if (totalArea > width * height * 2) {
            fail("malformedMask", "Mask rectangle work exceeds the configured limit");
        }
        rectangles.push(Object.freeze(rectangle));
    }
    return Object.freeze(rectangles);
}

function validateMaskReview(untrusted) {
    if (
        untrusted === null ||
        typeof untrusted !== "object" ||
        Array.isArray(untrusted) ||
        untrusted.reviewed !== true ||
        typeof untrusted.reviewer !== "string" ||
        untrusted.reviewer.trim().length === 0 ||
        untrusted.reviewer.length > 256 ||
        typeof untrusted.reason !== "string" ||
        untrusted.reason.trim().length === 0 ||
        untrusted.reason.length > 1_024 ||
        (untrusted.reviewedAt !== undefined &&
            (typeof untrusted.reviewedAt !== "string" ||
                untrusted.reviewedAt.length > 128)) ||
        Object.keys(untrusted).some(
            (key) => !["reviewed", "reviewer", "reason", "reviewedAt"].includes(key),
        )
    ) {
        fail(
            "malformedMask",
            "A mask requires reviewed=true, reviewer, reason, and optional reviewedAt metadata",
        );
    }
    return Object.freeze({
        reviewed: true,
        reviewer: untrusted.reviewer,
        reason: untrusted.reason,
        ...(untrusted.reviewedAt === undefined
            ? {}
            : { reviewedAt: untrusted.reviewedAt }),
    });
}

function buildMask(width, height, maskImage, rectangles) {
    const pixels = width * height;
    const mask = new Uint8Array(pixels);
    if (maskImage !== null) {
        let usesTransparency = false;
        for (let pixel = 0; pixel < pixels; pixel += 1) {
            if (maskImage.rgba[pixel * 4 + 3] < 255) {
                usesTransparency = true;
                break;
            }
        }
        for (let pixel = 0; pixel < pixels; pixel += 1) {
            const offset = pixel * 4;
            if (usesTransparency) {
                if (maskImage.rgba[offset + 3] > 0) mask[pixel] = 1;
            } else if (
                maskImage.rgba[offset] > 0 ||
                maskImage.rgba[offset + 1] > 0 ||
                maskImage.rgba[offset + 2] > 0
            ) {
                mask[pixel] = 1;
            }
        }
    }
    for (const rectangle of rectangles) {
        for (let y = rectangle.y; y < rectangle.y + rectangle.height; y += 1) {
            const start = y * width + rectangle.x;
            mask.fill(1, start, start + rectangle.width);
        }
    }
    let maskedPixels = 0;
    for (const value of mask) maskedPixels += value;
    if (maskedPixels === pixels) fail("malformedMask", "Mask excludes every image pixel");
    if (maskedPixels / pixels > MAXIMUM_MASKED_FRACTION) {
        fail(
            "malformedMask",
            `Mask excludes more than ${MAXIMUM_MASKED_FRACTION * 100}% of image pixels`,
        );
    }
    return { mask, maskedPixels };
}

function opaqueRgb(rgba) {
    const rgb = Buffer.allocUnsafe((rgba.length / 4) * 3);
    for (let pixel = 0; pixel < rgba.length / 4; pixel += 1) {
        const source = pixel * 4;
        const target = pixel * 3;
        const alpha = rgba[source + 3] / 255;
        rgb[target] = Math.round(rgba[source] * alpha + 255 * (1 - alpha));
        rgb[target + 1] = Math.round(
            rgba[source + 1] * alpha + 255 * (1 - alpha),
        );
        rgb[target + 2] = Math.round(
            rgba[source + 2] * alpha + 255 * (1 - alpha),
        );
    }
    return rgb;
}

function luminance(rgb, pixel) {
    const offset = pixel * 3;
    return (
        0.2126 * rgb[offset] +
        0.7152 * rgb[offset + 1] +
        0.0722 * rgb[offset + 2]
    );
}

function structuralSsim(reference, candidate, width, height, mask) {
    let weightedScore = 0;
    let weightedPixels = 0;
    for (let originY = 0; originY < height; originY += SSIM_WINDOW_SIZE) {
        for (let originX = 0; originX < width; originX += SSIM_WINDOW_SIZE) {
            let count = 0;
            let referenceSum = 0;
            let candidateSum = 0;
            let referenceSquaredSum = 0;
            let candidateSquaredSum = 0;
            let productSum = 0;
            for (
                let y = originY;
                y < Math.min(height, originY + SSIM_WINDOW_SIZE);
                y += 1
            ) {
                for (
                    let x = originX;
                    x < Math.min(width, originX + SSIM_WINDOW_SIZE);
                    x += 1
                ) {
                    const pixel = y * width + x;
                    if (mask[pixel] === 0) {
                        const left = luminance(reference, pixel);
                        const right = luminance(candidate, pixel);
                        count += 1;
                        referenceSum += left;
                        candidateSum += right;
                        referenceSquaredSum += left * left;
                        candidateSquaredSum += right * right;
                        productSum += left * right;
                    }
                }
            }
            if (count === 0) continue;
            const referenceMean = referenceSum / count;
            const candidateMean = candidateSum / count;
            const divisor = Math.max(1, count - 1);
            const referenceVariance = Math.max(
                0,
                (referenceSquaredSum - (referenceSum * referenceSum) / count) /
                    divisor,
            );
            const candidateVariance = Math.max(
                0,
                (candidateSquaredSum - (candidateSum * candidateSum) / count) /
                    divisor,
            );
            const covariance =
                (productSum - (referenceSum * candidateSum) / count) / divisor;
            const score =
                ((2 * referenceMean * candidateMean + SSIM_C1) *
                    (2 * covariance + SSIM_C2)) /
                ((referenceMean ** 2 + candidateMean ** 2 + SSIM_C1) *
                    (referenceVariance + candidateVariance + SSIM_C2));
            weightedScore += Math.max(-1, Math.min(1, score)) * count;
            weightedPixels += count;
        }
    }
    if (weightedPixels === 0) fail("malformedMask", "No pixels remain for SSIM");
    return weightedScore / weightedPixels;
}

function mismatchMetrics(reference, candidate, mask) {
    let comparedPixels = 0;
    let mismatchedPixels = 0;
    for (let pixel = 0; pixel < mask.length; pixel += 1) {
        if (mask[pixel] !== 0) continue;
        comparedPixels += 1;
        const offset = pixel * 3;
        if (
            reference[offset] !== candidate[offset] ||
            reference[offset + 1] !== candidate[offset + 1] ||
            reference[offset + 2] !== candidate[offset + 2]
        ) {
            mismatchedPixels += 1;
        }
    }
    return { comparedPixels, mismatchedPixels };
}

function rounded(value) {
    return Number(value.toFixed(9));
}

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        const result = Object.create(null);
        for (const key of Object.keys(value).sort()) {
            result[key] = canonicalize(value[key]);
        }
        return result;
    }
    return value;
}

function deterministicJson(value) {
    return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function inputDescriptor(root, file, bytes) {
    return {
        bytes: bytes.length,
        path: portableRelative(root.path, file.path),
        sha256: sha256(bytes),
    };
}

async function syncDirectory(directory) {
    await assertPinnedDirectory(directory, "Output report parent");
    const handle = await open(directory.path, constants.O_RDONLY).catch((error) => {
        throw safeError(error, "Output report parent cannot be synchronized");
    });
    try {
        await handle.sync();
    } finally {
        await handle.close().catch(() => undefined);
    }
}

async function writeAtomic(output, bytes, protectedFiles) {
    if (protectedFiles.some((file) => file.path === output.path)) {
        fail("unsafePath", "Output report must not overwrite an input file");
    }
    if (
        output.existing !== null &&
        protectedFiles.some(
            (file) =>
                file.device === output.existing.device &&
                file.inode === output.existing.inode,
        )
    ) {
        fail("unsafePath", "Output report must not replace an input hard link");
    }
    await assertPinnedDirectory(output.parent, "Output report parent");
    const temporary = join(
        output.parent.path,
        `.${basename(output.path)}.${randomUUID()}.tmp`,
    );
    let handle;
    let temporaryIdentity = null;
    try {
        handle = await open(
            temporary,
            constants.O_WRONLY |
                constants.O_CREAT |
                constants.O_EXCL |
                constants.O_NOFOLLOW,
            0o600,
        );
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile()) fail("unsafePath", "Temporary report is not a file");
        temporaryIdentity = identity(metadata);
        await handle.close();
        handle = null;

        await assertPinnedDirectory(output.parent, "Output report parent");
        const temporaryBeforeRename = await lstat(temporary);
        if (
            temporaryBeforeRename.isSymbolicLink() ||
            !temporaryBeforeRename.isFile() ||
            !sameIdentity(temporaryBeforeRename, temporaryIdentity)
        ) {
            fail("unsafePath", "Temporary report changed before commit");
        }
        let destination = null;
        try {
            destination = await lstat(output.path);
        } catch (error) {
            if (!isErrno(error, "ENOENT")) throw error;
        }
        if (
            destination !== null &&
            (destination.isSymbolicLink() || !destination.isFile())
        ) {
            fail("unsafePath", "Output report changed to an unsafe file");
        }
        if (
            destination !== null &&
            protectedFiles.some(
                (file) => file.device === destination.dev && file.inode === destination.ino,
            )
        ) {
            fail("unsafePath", "Output report changed to an input hard link");
        }
        await rename(temporary, output.path);
        temporaryIdentity = null;
        await syncDirectory(output.parent);
    } catch (error) {
        throw safeError(error, "Unable to write visual comparison report");
    } finally {
        if (handle !== undefined && handle !== null) {
            await handle.close().catch(() => undefined);
        }
        if (temporaryIdentity !== null) {
            const metadata = await lstat(temporary).catch(() => null);
            if (
                metadata !== null &&
                metadata.isFile() &&
                !metadata.isSymbolicLink() &&
                sameIdentity(metadata, temporaryIdentity)
            ) {
                await unlink(temporary).catch(() => undefined);
            }
        }
    }
}

function inlineOrFile(inline, fromFile, label) {
    if (inline !== undefined && fromFile !== undefined) {
        fail("invalidInput", `${label} cannot be supplied inline and by file`);
    }
}

export async function compareVisuals(options) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        fail("invalidInput", "Visual comparison options must be an object");
    }
    const root = await pinRoot(options.parityRoot);
    const [referenceFile, candidateFile] = await Promise.all([
        resolveInput(root, options.referencePath, "Reference PNG"),
        resolveInput(root, options.candidatePath, "Candidate PNG"),
    ]);
    if (
        referenceFile.path === candidateFile.path ||
        (referenceFile.device === candidateFile.device &&
            referenceFile.inode === candidateFile.inode)
    ) {
        fail("invalidInput", "Reference and candidate PNGs must be distinct files");
    }
    const output = await resolveOutput(root, options.outputPath);
    inlineOrFile(options.maskRectangles, options.maskRectanglesPath, "Mask rectangles");
    inlineOrFile(options.maskReview, options.maskReviewPath, "Mask review");
    inlineOrFile(options.metadata, options.metadataPath, "Metadata");

    const optionalFiles = {};
    if (options.maskPath !== undefined) {
        optionalFiles.mask = await resolveInput(root, options.maskPath, "Mask PNG");
    }
    if (options.maskRectanglesPath !== undefined) {
        optionalFiles.rectangles = await resolveInput(
            root,
            options.maskRectanglesPath,
            "Mask rectangles",
        );
    }
    if (options.maskReviewPath !== undefined) {
        optionalFiles.review = await resolveInput(
            root,
            options.maskReviewPath,
            "Mask review",
        );
    }
    if (options.metadataPath !== undefined) {
        optionalFiles.metadata = await resolveInput(
            root,
            options.metadataPath,
            "Comparison metadata",
        );
    }
    const protectedFiles = [referenceFile, candidateFile, ...Object.values(optionalFiles)];
    const uniqueInputs = new Set();
    for (const file of protectedFiles) {
        const key = `${file.device}:${file.inode}`;
        if (uniqueInputs.has(key)) fail("invalidInput", "Comparison inputs must be distinct files");
        uniqueInputs.add(key);
    }

    const [referenceBytes, candidateBytes] = await Promise.all([
        readBoundedFile(referenceFile, MAXIMUM_PNG_FILE_BYTES, "Reference PNG"),
        readBoundedFile(candidateFile, MAXIMUM_PNG_FILE_BYTES, "Candidate PNG"),
    ]);
    const reference = decodePng(referenceBytes, "Reference PNG");
    const candidate = decodePng(candidateBytes, "Candidate PNG");
    if (
        reference.width !== candidate.width ||
        reference.height !== candidate.height
    ) {
        fail(
            "geometryMismatch",
            `Normalized dimensions differ: ${reference.width}x${reference.height} vs ${candidate.width}x${candidate.height}`,
        );
    }

    let maskBytes = null;
    let maskImage = null;
    if (optionalFiles.mask !== undefined) {
        maskBytes = await readBoundedFile(
            optionalFiles.mask,
            MAXIMUM_PNG_FILE_BYTES,
            "Mask PNG",
        );
        maskImage = decodePng(maskBytes, "Mask PNG");
        if (
            maskImage.width !== reference.width ||
            maskImage.height !== reference.height
        ) {
            fail("malformedMask", "Mask PNG dimensions must match normalized image dimensions");
        }
    }

    let rectanglesSource = options.maskRectangles ?? [];
    let rectanglesBytes = null;
    if (optionalFiles.rectangles !== undefined) {
        rectanglesBytes = await readBoundedFile(
            optionalFiles.rectangles,
            MAXIMUM_JSON_BYTES,
            "Mask rectangles",
        );
        try {
            rectanglesSource = JSON.parse(rectanglesBytes.toString("utf8"));
        } catch {
            fail("malformedMask", "Mask rectangles are not valid JSON");
        }
    }
    const rectangles = validateRectangles(
        rectanglesSource,
        reference.width,
        reference.height,
    );
    const maskRequested = maskImage !== null || rectangles.length > 0;

    let reviewSource = options.maskReview;
    let reviewBytes = null;
    if (optionalFiles.review !== undefined) {
        reviewBytes = await readBoundedFile(
            optionalFiles.review,
            MAXIMUM_JSON_BYTES,
            "Mask review",
        );
        try {
            reviewSource = JSON.parse(reviewBytes.toString("utf8"));
        } catch {
            fail("malformedMask", "Mask review is not valid JSON");
        }
    }
    if (maskRequested && reviewSource === undefined) {
        fail("malformedMask", "A reviewed text-edge mask requires review metadata");
    }
    if (!maskRequested && reviewSource !== undefined) {
        fail("malformedMask", "Mask review metadata was supplied without a mask");
    }
    const review = maskRequested ? validateMaskReview(reviewSource) : null;

    let metadata = null;
    let metadataBytes = null;
    if (optionalFiles.metadata !== undefined) {
        const loaded = await readJsonInput(
            root,
            options.metadataPath,
            "Comparison metadata",
        );
        metadata = loaded.value;
        metadataBytes = loaded.bytes;
    } else if (options.metadata !== undefined) {
        metadata = validateJson(options.metadata);
    }

    const { mask, maskedPixels } = buildMask(
        reference.width,
        reference.height,
        maskImage,
        rectangles,
    );
    const referenceRgb = opaqueRgb(reference.rgba);
    const candidateRgb = opaqueRgb(candidate.rgba);
    const ssim = structuralSsim(
        referenceRgb,
        candidateRgb,
        reference.width,
        reference.height,
        mask,
    );
    const mismatch = mismatchMetrics(referenceRgb, candidateRgb, mask);
    const mismatchPercent =
        (mismatch.mismatchedPixels / mismatch.comparedPixels) * 100;
    const reportedSsim = rounded(ssim);
    const reportedMismatchPercent = rounded(mismatchPercent);
    const failures = [];
    if (reportedSsim < MINIMUM_STRUCTURAL_SSIM) {
        failures.push("structuralSsimBelowMinimum");
    }
    if (reportedMismatchPercent > MAXIMUM_MISMATCH_PERCENT) {
        failures.push("pixelMismatchAboveMaximum");
    }

    const inputs = {
        candidate: inputDescriptor(root, candidateFile, candidateBytes),
        reference: inputDescriptor(root, referenceFile, referenceBytes),
    };
    if (optionalFiles.mask !== undefined) {
        inputs.mask = inputDescriptor(root, optionalFiles.mask, maskBytes);
    }
    if (optionalFiles.rectangles !== undefined) {
        inputs.maskRectangles = inputDescriptor(
            root,
            optionalFiles.rectangles,
            rectanglesBytes,
        );
    }
    if (optionalFiles.review !== undefined) {
        inputs.maskReview = inputDescriptor(root, optionalFiles.review, reviewBytes);
    }
    if (optionalFiles.metadata !== undefined) {
        inputs.metadata = inputDescriptor(
            root,
            optionalFiles.metadata,
            metadataBytes,
        );
    }

    const totalPixels = reference.width * reference.height;
    const report = {
        algorithm: {
            alphaNormalization: "sRGB bytes composited over opaque white",
            colorProfileHandling: "PNG profiles and gamma chunks are not transformed",
            maskPixels:
                "non-zero alpha on transparent masks; non-black RGB on fully opaque masks",
            mismatch: "exact normalized RGB pixel inequality after reviewed masking",
            ssim: {
                constants: { c1: SSIM_C1, c2: SSIM_C2 },
                kind: "sample-variance luminance SSIM",
                luminance: "Rec.709 coefficients on normalized sRGB bytes",
                windowSize: SSIM_WINDOW_SIZE,
            },
        },
        failures,
        geometry: {
            aspectRatio: rounded(reference.width / reference.height),
            candidate: { height: candidate.height, width: candidate.width },
            equalNormalizedDimensions: true,
            normalized: { height: reference.height, width: reference.width },
            reference: { height: reference.height, width: reference.width },
            totalPixels,
        },
        inputs,
        mask: {
            maskedFraction: rounded(maskedPixels / totalPixels),
            maskedPixels,
            png: maskImage !== null,
            rectangles,
            review,
        },
        metadata,
        metrics: {
            comparedPixels: mismatch.comparedPixels,
            mismatchedPixels: mismatch.mismatchedPixels,
            mismatchPercent: reportedMismatchPercent,
            structuralSsim: reportedSsim,
        },
        pass: failures.length === 0,
        schemaVersion: 1,
        thresholds: {
            maximumMismatchPercent: MAXIMUM_MISMATCH_PERCENT,
            minimumStructuralSsim: MINIMUM_STRUCTURAL_SSIM,
        },
    };
    const reportBytes = Buffer.from(deterministicJson(report), "utf8");
    await writeAtomic(output, reportBytes, protectedFiles);
    return JSON.parse(reportBytes.toString("utf8"));
}

function usage() {
    return [
        "Usage:",
        "  node visual-compare.mjs --root <dir> --reference <png> --candidate <png> --output <json>",
        "    [--mask <png>] [--mask-rectangles <json>] [--mask-review <json>] [--metadata <json>]",
    ].join("\n");
}

function parseArguments(arguments_) {
    if (arguments_.includes("--help")) return { help: true };
    const values = new Map();
    const allowed = new Set([
        "--root",
        "--reference",
        "--candidate",
        "--output",
        "--mask",
        "--mask-rectangles",
        "--mask-review",
        "--metadata",
    ]);
    for (let index = 0; index < arguments_.length; index += 2) {
        const key = arguments_[index];
        const value = arguments_[index + 1];
        if (!allowed.has(key) || value === undefined || value.startsWith("--")) {
            fail("invalidInput", `Invalid CLI argument near ${String(key)}`);
        }
        if (values.has(key)) fail("invalidInput", `Duplicate CLI argument ${key}`);
        values.set(key, value);
    }
    for (const required of ["--root", "--reference", "--candidate", "--output"]) {
        if (!values.has(required)) fail("invalidInput", `Missing required argument ${required}`);
    }
    return {
        parityRoot: values.get("--root"),
        referencePath: values.get("--reference"),
        candidatePath: values.get("--candidate"),
        outputPath: values.get("--output"),
        ...(values.has("--mask") ? { maskPath: values.get("--mask") } : {}),
        ...(values.has("--mask-rectangles")
            ? { maskRectanglesPath: values.get("--mask-rectangles") }
            : {}),
        ...(values.has("--mask-review")
            ? { maskReviewPath: values.get("--mask-review") }
            : {}),
        ...(values.has("--metadata")
            ? { metadataPath: values.get("--metadata") }
            : {}),
    };
}

async function main() {
    try {
        const options = parseArguments(process.argv.slice(2));
        if (options.help === true) {
            process.stdout.write(`${usage()}\n`);
            return;
        }
        const report = await compareVisuals(options);
        process.stdout.write(
            `${JSON.stringify({ pass: report.pass, report: options.outputPath })}\n`,
        );
        if (!report.pass) process.exitCode = 1;
    } catch (error) {
        const normalized = safeError(error, "Visual comparison failed");
        process.stderr.write(`${normalized.code}: ${normalized.message}\n${usage()}\n`);
        process.exitCode = 2;
    }
}

if (
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
    await main();
}
