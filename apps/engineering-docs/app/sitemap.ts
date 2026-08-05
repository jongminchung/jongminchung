import type { MetadataRoute } from "next";
import manifest from "../generated/content-manifest.json";
import {
  createDocHref,
  createSectionHref,
  locales,
  sectionLandingSections,
} from "../lib/content-model";

const siteOrigin = "https://jongminchung.dev";

function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteOrigin).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const documentEntries: MetadataRoute.Sitemap = manifest.map((document) => ({
    url: absoluteUrl(document.href),
    lastModified: document.updatedAt,
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [locale, absoluteUrl(createDocHref(locale, document.id))]),
      ),
    },
  }));
  const sectionEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    sectionLandingSections.map((section) => {
      const latest = manifest
        .filter((document) => document.locale === locale && document.section === section)
        .toSorted(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) || left.order - right.order,
        )[0];
      if (latest === undefined) throw new Error(`Missing ${locale}/${section} section page.`);
      return {
        url: absoluteUrl(createSectionHref(locale, section)),
        lastModified: latest.updatedAt,
        alternates: {
          languages: Object.fromEntries(
            locales.map((candidate) => [
              candidate,
              absoluteUrl(createSectionHref(candidate, section)),
            ]),
          ),
        },
      };
    }),
  );
  return [...documentEntries, ...sectionEntries];
}
