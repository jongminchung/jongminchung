import type { MetadataRoute } from "next";
import manifest from "../generated/content-manifest.json";
import { createDocHref, locales } from "../lib/content-model";

const siteOrigin = "https://jongminchung.dev";

function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteOrigin).toString();
}

export default function sitemap(): MetadataRoute.Sitemap {
  return manifest.map((document) => ({
    url: absoluteUrl(document.href),
    lastModified: document.updatedAt,
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [locale, absoluteUrl(createDocHref(locale, document.id))]),
      ),
    },
  }));
}
