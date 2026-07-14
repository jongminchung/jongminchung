export const locales = ["ko", "en"] as const;
export const sections = ["overview", "handbook", "packages", "deep-dive"] as const;
export const documentStatuses = ["stable", "deprecated", "experimental"] as const;

export type Locale = (typeof locales)[number];
export type DocSection = (typeof sections)[number];
export type DocumentStatus = (typeof documentStatuses)[number];

export interface DocMetadata {
  readonly id: string;
  readonly locale: Locale;
  readonly section: DocSection;
  readonly title: string;
  readonly displayTitle?: string;
  readonly description: string;
  readonly order: number;
  readonly updatedAt: string;
  readonly verifiedAt?: string;
  readonly tags: readonly string[];
  readonly status: DocumentStatus;
  readonly sourceUrl: string;
  readonly packageName?: string;
  readonly packageVersion?: string;
  readonly apiSymbols?: readonly string[];
}

export interface OutlineEntry {
  readonly id: string;
  readonly label: string;
  readonly level: 2 | 3;
}

export interface ContentManifestEntry extends DocMetadata {
  readonly href: string;
  readonly outline: readonly OutlineEntry[];
}

export interface SearchDocument {
  readonly id: string;
  readonly locale: Locale;
  readonly section: DocSection;
  readonly title: string;
  readonly description: string;
  readonly order: number;
  readonly href: string;
  readonly headings: readonly string[];
  readonly tags: readonly string[];
  readonly apiSymbols: readonly string[];
  readonly body: string;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Metadata field "${key}" must be a non-empty string.`);
  }
  return value;
}

function optionalString(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Metadata field "${key}" must be a non-empty string.`);
  }
  return value;
}

function requireStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
  optional = false,
): readonly string[] | undefined {
  const value = record[key];
  if (value === undefined && optional) return undefined;
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Metadata field "${key}" must be an array of strings.`);
  }
  return Object.freeze([...value]);
}

function isOneOf<const TValue extends string>(
  value: string,
  candidates: readonly TValue[],
): value is TValue {
  return candidates.some((candidate) => candidate === value);
}

export function parseDocMetadata(value: unknown, source = "document"): DocMetadata {
  if (!isRecord(value)) throw new Error(`${source}: metadata must be an object.`);

  const locale = requireString(value, "locale");
  const section = requireString(value, "section");
  const status = requireString(value, "status");
  const updatedAt = requireString(value, "updatedAt");
  const verifiedAt = optionalString(value, "verifiedAt");
  const sourceUrl = requireString(value, "sourceUrl");
  const order = value.order;

  if (!isOneOf(locale, locales)) throw new Error(`${source}: unsupported locale "${locale}".`);
  if (!isOneOf(section, sections)) throw new Error(`${source}: unsupported section "${section}".`);
  if (!isOneOf(status, documentStatuses)) {
    throw new Error(`${source}: unsupported status "${status}".`);
  }
  if (typeof order !== "number" || !Number.isInteger(order) || order < 0) {
    throw new Error(`${source}: metadata field "order" must be a non-negative integer.`);
  }
  if (!ISO_DATE_PATTERN.test(updatedAt) || Number.isNaN(Date.parse(`${updatedAt}T00:00:00Z`))) {
    throw new Error(`${source}: metadata field "updatedAt" must be an ISO date.`);
  }
  if (
    verifiedAt !== undefined &&
    (!ISO_DATE_PATTERN.test(verifiedAt) || Number.isNaN(Date.parse(`${verifiedAt}T00:00:00Z`)))
  ) {
    throw new Error(`${source}: metadata field "verifiedAt" must be an ISO date.`);
  }
  try {
    new URL(sourceUrl);
  } catch {
    throw new Error(`${source}: metadata field "sourceUrl" must be an absolute URL.`);
  }

  const packageName = value.packageName;
  const packageVersion = value.packageVersion;
  if (packageName !== undefined && typeof packageName !== "string") {
    throw new Error(`${source}: metadata field "packageName" must be a string.`);
  }
  if (packageVersion !== undefined && typeof packageVersion !== "string") {
    throw new Error(`${source}: metadata field "packageVersion" must be a string.`);
  }

  const displayTitle = optionalString(value, "displayTitle");

  return Object.freeze({
    id: requireString(value, "id"),
    locale,
    section,
    title: requireString(value, "title"),
    ...(displayTitle === undefined ? {} : { displayTitle }),
    description: requireString(value, "description"),
    order,
    updatedAt,
    ...(verifiedAt === undefined ? {} : { verifiedAt }),
    tags: requireStringArray(value, "tags") ?? [],
    status,
    sourceUrl,
    ...(packageName === undefined ? {} : { packageName }),
    ...(packageVersion === undefined ? {} : { packageVersion }),
    ...(value.apiSymbols === undefined
      ? {}
      : { apiSymbols: requireStringArray(value, "apiSymbols", true) }),
  });
}

export function displayTitleFor(document: Pick<DocMetadata, "displayTitle" | "title">): string {
  return document.displayTitle ?? document.title;
}

export function createDocHref(locale: Locale, id: string): string {
  return `/${locale}/${id}`;
}

export function isLocale(value: string): value is Locale {
  return isOneOf(value, locales);
}
