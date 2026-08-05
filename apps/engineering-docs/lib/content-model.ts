export const locales = ["ko", "en"] as const;
export const sections = ["overview", "handbook", "packages", "deep-dive"] as const;
export const sectionLandingSections = ["handbook", "packages", "deep-dive"] as const;
export const documentStatuses = ["stable", "deprecated", "experimental"] as const;

export type Locale = (typeof locales)[number];
export type DocSection = (typeof sections)[number];
export type SectionLanding = (typeof sectionLandingSections)[number];
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

export interface NavigationEntry {
  readonly id: string;
  readonly section: DocSection;
  readonly title: string;
  readonly displayTitle?: string;
  readonly href: string;
}

export interface CurrentDocumentNavigationEntry extends NavigationEntry {
  readonly kind: "document";
  readonly outline: readonly OutlineEntry[];
}

export interface CurrentSectionNavigationEntry extends NavigationEntry {
  readonly kind: "section";
  readonly section: SectionLanding;
}

export type CurrentNavigationEntry = CurrentDocumentNavigationEntry | CurrentSectionNavigationEntry;

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
const DOCUMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const metadataFields = {
  id: true,
  locale: true,
  section: true,
  title: true,
  displayTitle: true,
  description: true,
  order: true,
  updatedAt: true,
  verifiedAt: true,
  tags: true,
  status: true,
  sourceUrl: true,
  packageName: true,
  packageVersion: true,
  apiSymbols: true,
} satisfies Readonly<Record<keyof DocMetadata, true>>;
const metadataFieldNames = new Set<string>(Object.keys(metadataFields));

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Metadata field "${key}" must be a non-empty string.`);
  }
  return value.trim();
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
  return value.trim();
}

function validateStringArray(value: unknown, key: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`Metadata field "${key}" must be an array of strings.`);
  }
  const normalized = value.map((item) => item.trim());
  if (normalized.some((item) => item.length === 0)) {
    throw new Error(`Metadata field "${key}" must not contain empty strings.`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`Metadata field "${key}" must not contain duplicates.`);
  }
  return Object.freeze(normalized);
}

function requireStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] {
  return validateStringArray(record[key], key);
}

function optionalStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] | undefined {
  const value = record[key];
  return value === undefined ? undefined : validateStringArray(value, key);
}

function isOneOf<const TValue extends string>(
  value: string,
  candidates: readonly TValue[],
): value is TValue {
  return candidates.some((candidate) => candidate === value);
}

export function parseDocMetadata(value: unknown, source = "document"): DocMetadata {
  if (!isRecord(value)) throw new Error(`${source}: metadata must be an object.`);

  const unknownFields = Object.keys(value).filter((key) => !metadataFieldNames.has(key));
  if (unknownFields.length > 0) {
    throw new Error(`${source}: unsupported metadata fields: ${unknownFields.join(", ")}.`);
  }

  const id = requireString(value, "id");
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
  if (!DOCUMENT_ID_PATTERN.test(id)) {
    throw new Error(`${source}: metadata field "id" must be a lowercase path.`);
  }
  if (
    (section === "overview" && id !== "overview") ||
    (section !== "overview" && !id.startsWith(`${section}/`))
  ) {
    throw new Error(`${source}: document ID "${id}" does not belong to section "${section}".`);
  }
  if (typeof order !== "number" || !Number.isInteger(order) || order < 0) {
    throw new Error(`${source}: metadata field "order" must be a non-negative integer.`);
  }
  if (!isIsoDate(updatedAt)) {
    throw new Error(`${source}: metadata field "updatedAt" must be an ISO date.`);
  }
  if (verifiedAt !== undefined && !isIsoDate(verifiedAt)) {
    throw new Error(`${source}: metadata field "verifiedAt" must be an ISO date.`);
  }
  if (verifiedAt !== undefined && verifiedAt < updatedAt) {
    throw new Error(`${source}: metadata field "verifiedAt" must not precede "updatedAt".`);
  }
  let parsedSourceUrl: URL;
  try {
    parsedSourceUrl = new URL(sourceUrl);
  } catch {
    throw new Error(`${source}: metadata field "sourceUrl" must be an absolute URL.`);
  }
  if (
    parsedSourceUrl.protocol !== "https:" ||
    parsedSourceUrl.username !== "" ||
    parsedSourceUrl.password !== ""
  ) {
    throw new Error(`${source}: metadata field "sourceUrl" must be a credential-free HTTPS URL.`);
  }

  const displayTitle = optionalString(value, "displayTitle");
  const packageName = optionalString(value, "packageName");
  const packageVersion = optionalString(value, "packageVersion");
  const apiSymbols = optionalStringArray(value, "apiSymbols");

  return Object.freeze({
    id,
    locale,
    section,
    title: requireString(value, "title"),
    ...(displayTitle === undefined ? {} : { displayTitle }),
    description: requireString(value, "description"),
    order,
    updatedAt,
    ...(verifiedAt === undefined ? {} : { verifiedAt }),
    tags: requireStringArray(value, "tags"),
    status,
    sourceUrl,
    ...(packageName === undefined ? {} : { packageName }),
    ...(packageVersion === undefined ? {} : { packageVersion }),
    ...(apiSymbols === undefined ? {} : { apiSymbols }),
  });
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function displayTitleFor(document: Pick<DocMetadata, "displayTitle" | "title">): string {
  return document.displayTitle ?? document.title;
}

export function createDocHref(locale: Locale, id: string): string {
  return `/${locale}/${id}`;
}

export function createSectionHref(locale: Locale, section: DocSection): string {
  return section === "overview" ? createDocHref(locale, "overview") : `/${locale}/${section}`;
}

export function createOgImageHref(locale: Locale, id: string): string {
  return `/og/${locale}/${id}`;
}

export function createDocumentKey(locale: string, id: string): string {
  return `${locale}/${id}`;
}

export function compareDocumentMetadata(
  left: Pick<DocMetadata, "id" | "locale" | "order" | "section">,
  right: Pick<DocMetadata, "id" | "locale" | "order" | "section">,
): number {
  return (
    left.locale.localeCompare(right.locale) ||
    sections.indexOf(left.section) - sections.indexOf(right.section) ||
    left.order - right.order ||
    left.id.localeCompare(right.id)
  );
}

export function isLocale(value: string): value is Locale {
  return isOneOf(value, locales);
}

export function isSectionLanding(value: string): value is SectionLanding {
  return isOneOf(value, sectionLandingSections);
}
