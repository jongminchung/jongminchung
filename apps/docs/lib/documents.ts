import type { ComponentType } from "react";
import manifestData from "@/generated/content-manifest.json";
import {
  createDocHref,
  isLocale,
  parseDocMetadata,
  type ContentManifestEntry,
  type DocSection,
  type Locale,
  type OutlineEntry,
} from "./content-model";

interface MdxModule {
  readonly default: ComponentType;
}

export interface LoadedDocument {
  readonly metadata: ContentManifestEntry;
  readonly Content: ComponentType;
  readonly previous: ContentManifestEntry | null;
  readonly next: ContentManifestEntry | null;
}

const sectionOrder = ["overview", "handbook", "packages", "deep-dive"] as const;

const docLoaders = {
  "ko/overview": () => import("@/content/ko/overview.mdx"),
  "ko/handbook/collaboration": () => import("@/content/ko/handbook/collaboration.mdx"),
  "ko/handbook/ddd": () => import("@/content/ko/handbook/ddd.mdx"),
  "ko/packages/remark-plantuml": () => import("@/content/ko/packages/remark-plantuml.mdx"),
  "ko/packages/tooling": () => import("@/content/ko/packages/tooling.mdx"),
  "ko/deep-dive/nextjs-16": () => import("@/content/ko/deep-dive/nextjs-16.mdx"),
  "ko/deep-dive/pnpm-11": () => import("@/content/ko/deep-dive/pnpm-11.mdx"),
  "ko/deep-dive/node-26": () => import("@/content/ko/deep-dive/node-26.mdx"),
  "ko/deep-dive/typescript-6": () => import("@/content/ko/deep-dive/typescript-6.mdx"),
  "en/overview": () => import("@/content/en/overview.mdx"),
  "en/handbook/collaboration": () => import("@/content/en/handbook/collaboration.mdx"),
  "en/handbook/ddd": () => import("@/content/en/handbook/ddd.mdx"),
  "en/packages/remark-plantuml": () => import("@/content/en/packages/remark-plantuml.mdx"),
  "en/packages/tooling": () => import("@/content/en/packages/tooling.mdx"),
  "en/deep-dive/nextjs-16": () => import("@/content/en/deep-dive/nextjs-16.mdx"),
  "en/deep-dive/pnpm-11": () => import("@/content/en/deep-dive/pnpm-11.mdx"),
  "en/deep-dive/node-26": () => import("@/content/en/deep-dive/node-26.mdx"),
  "en/deep-dive/typescript-6": () => import("@/content/en/deep-dive/typescript-6.mdx"),
} satisfies Readonly<Record<string, () => Promise<MdxModule>>>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOutline(value: unknown, source: string): readonly OutlineEntry[] {
  if (!Array.isArray(value)) throw new Error(`${source}: outline must be an array.`);
  return value.map((item) => {
    if (!isRecord(item)) throw new Error(`${source}: invalid outline item.`);
    const { id, label, level } = item;
    if (typeof id !== "string" || typeof label !== "string" || (level !== 2 && level !== 3)) {
      throw new Error(`${source}: invalid outline item.`);
    }
    return Object.freeze({ id, label, level });
  });
}

function parseManifest(value: unknown): readonly ContentManifestEntry[] {
  if (!Array.isArray(value)) throw new Error("Content manifest must be an array.");
  return Object.freeze(
    value.map((item, index) => {
      if (!isRecord(item)) throw new Error(`Manifest item ${index} must be an object.`);
      const metadata = parseDocMetadata(item, `manifest[${index}]`);
      const href = item.href;
      if (typeof href !== "string" || href !== createDocHref(metadata.locale, metadata.id)) {
        throw new Error(`manifest[${index}]: invalid href.`);
      }
      return Object.freeze({ ...metadata, href, outline: parseOutline(item.outline, href) });
    }),
  );
}

export const documents = parseManifest(manifestData);

function compareDocuments(left: ContentManifestEntry, right: ContentManifestEntry): number {
  const leftSection = sectionOrder.indexOf(left.section);
  const rightSection = sectionOrder.indexOf(right.section);
  return leftSection - rightSection || left.order - right.order;
}

export function getLocalizedDocuments(locale: Locale): readonly ContentManifestEntry[] {
  return documents.filter((document) => document.locale === locale).sort(compareDocuments);
}

export function getSectionDocuments(
  locale: Locale,
  section: DocSection,
): readonly ContentManifestEntry[] {
  return getLocalizedDocuments(locale).filter((document) => document.section === section);
}

export function findDocument(locale: string, id: string): ContentManifestEntry | null {
  if (!isLocale(locale)) return null;
  return documents.find((document) => document.locale === locale && document.id === id) ?? null;
}

export async function loadDocument(locale: Locale, id: string): Promise<LoadedDocument | null> {
  const metadata = findDocument(locale, id);
  const loader = docLoaders[`${locale}/${id}` as keyof typeof docLoaders];
  if (metadata === null || loader === undefined) return null;

  const localized = getLocalizedDocuments(locale);
  const index = localized.findIndex((document) => document.id === id);
  const module = await loader();
  return Object.freeze({
    metadata,
    Content: module.default,
    previous: index <= 0 ? null : (localized[index - 1] ?? null),
    next: index < 0 || index >= localized.length - 1 ? null : (localized[index + 1] ?? null),
  });
}
