const EXCALIDRAW_ASSET_PREFIX = "/diagrams/";
const EXCALIDRAW_EXTENSION = ".excalidraw";

type JsonRecord = Readonly<Record<string, unknown>>;

export interface ExcalidrawScene {
  readonly type: "excalidraw";
  readonly version: number;
  readonly source: string | null;
  readonly elements: readonly JsonRecord[];
  readonly appState: JsonRecord;
  readonly files: Readonly<Record<string, JsonRecord>>;
  readonly elementCount: number;
  readonly textContent: readonly string[];
}

export interface ExcalidrawAsset {
  readonly filename: string;
  readonly slug: string;
  readonly src: string;
}

function fail(sourceName: string, message: string): never {
  throw new Error(`${sourceName}: ${message}`);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, sourceName: string, field: string): JsonRecord {
  if (!isRecord(value)) fail(sourceName, `field "${field}" must be an object.`);
  return value;
}

function requireString(value: unknown, sourceName: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(sourceName, `field "${field}" must be a non-empty string.`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, sourceName: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(sourceName, `field "${field}" must be a finite number.`);
  }
  return value;
}

function validateBounds(element: JsonRecord, sourceName: string, id: string): void {
  const x = requireFiniteNumber(element.x, sourceName, `elements[${id}].x`);
  const y = requireFiniteNumber(element.y, sourceName, `elements[${id}].y`);
  const width = requireFiniteNumber(element.width, sourceName, `elements[${id}].width`);
  const height = requireFiniteNumber(element.height, sourceName, `elements[${id}].height`);

  if (!Number.isFinite(x + y)) fail(sourceName, `element "${id}" has invalid coordinates.`);
  if (width < 0 || height < 0 || (width === 0 && height === 0)) {
    fail(sourceName, `element "${id}" must have non-negative, non-empty bounds.`);
  }
}

function parseFiles(value: unknown, sourceName: string): Readonly<Record<string, JsonRecord>> {
  const record = requireRecord(value, sourceName, "files");
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record).map(([id, file]) => {
        if (id.length === 0) fail(sourceName, "file IDs must not be empty.");
        return [id, requireRecord(file, sourceName, `files[${id}]`)] as const;
      }),
    ),
  );
}

function parseElements(
  value: unknown,
  files: Readonly<Record<string, JsonRecord>>,
  sourceName: string,
): readonly JsonRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(sourceName, 'field "elements" must be a non-empty array.');
  }

  const ids = new Set<string>();
  return Object.freeze(
    value.map((rawElement, index) => {
      const element = requireRecord(rawElement, sourceName, `elements[${index}]`);
      const id = requireString(element.id, sourceName, `elements[${index}].id`);
      const type = requireString(element.type, sourceName, `elements[${id}].type`);
      if (ids.has(id)) fail(sourceName, `duplicate element ID "${id}".`);
      ids.add(id);

      validateBounds(element, sourceName, id);
      if (element.isDeleted !== undefined && typeof element.isDeleted !== "boolean") {
        fail(sourceName, `elements[${id}].isDeleted must be a boolean when present.`);
      }

      if (type === "image" && element.isDeleted !== true) {
        const fileId = requireString(element.fileId, sourceName, `elements[${id}].fileId`);
        if (files[fileId] === undefined) {
          fail(sourceName, `image element "${id}" references missing file "${fileId}".`);
        }
      }
      return element;
    }),
  );
}

export function parseExcalidrawValue(
  value: unknown,
  sourceName = "Excalidraw scene",
): ExcalidrawScene {
  const root = requireRecord(value, sourceName, "root");
  if (root.type !== "excalidraw") fail(sourceName, 'field "type" must be "excalidraw".');

  const version = requireFiniteNumber(root.version, sourceName, "version");
  if (!Number.isInteger(version) || version <= 0) {
    fail(sourceName, 'field "version" must be a positive integer.');
  }

  const files = parseFiles(root.files, sourceName);
  const elements = parseElements(root.elements, files, sourceName);
  const appState = requireRecord(root.appState, sourceName, "appState");
  const elementCount = elements.filter((element) => element.isDeleted !== true).length;
  if (elementCount === 0) fail(sourceName, "scene must contain at least one non-deleted element.");
  const textContent = Object.freeze(
    elements.flatMap((element) =>
      element.isDeleted !== true &&
      typeof element.text === "string" &&
      element.text.trim().length > 0
        ? [element.text]
        : [],
    ),
  );

  return Object.freeze({
    type: "excalidraw",
    version,
    source: typeof root.source === "string" ? root.source : null,
    elements,
    appState,
    files,
    elementCount,
    textContent,
  });
}

export function parseExcalidrawSource(
  source: string,
  sourceName = "Excalidraw scene",
): ExcalidrawScene {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown JSON parse error";
    fail(sourceName, `invalid JSON (${detail}).`);
  }
  return parseExcalidrawValue(value, sourceName);
}

export function parseExcalidrawFilename(filename: string): ExcalidrawAsset {
  if (
    !filename.endsWith(EXCALIDRAW_EXTENSION) ||
    filename.startsWith(".") ||
    filename.includes("..") ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\.excalidraw$/u.test(filename)
  ) {
    throw new Error(`Unsupported Excalidraw filename: ${filename}`);
  }
  const slug = filename.slice(0, -EXCALIDRAW_EXTENSION.length);
  return Object.freeze({ filename, slug, src: `${EXCALIDRAW_ASSET_PREFIX}${filename}` });
}

export function parseExcalidrawAssetSrc(src: string): ExcalidrawAsset {
  if (!src.startsWith(EXCALIDRAW_ASSET_PREFIX)) {
    throw new Error(`Excalidraw sources must use ${EXCALIDRAW_ASSET_PREFIX}: ${src}`);
  }
  const filename = src.slice(EXCALIDRAW_ASSET_PREFIX.length);
  if (filename.includes("/") || filename.includes("\\")) {
    throw new Error(`Excalidraw sources must stay inside ${EXCALIDRAW_ASSET_PREFIX}: ${src}`);
  }
  const asset = parseExcalidrawFilename(filename);
  if (asset.src !== src) throw new Error(`Unsupported Excalidraw source: ${src}`);
  return asset;
}
