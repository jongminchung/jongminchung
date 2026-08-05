import { describe, expect, it } from "vitest";
import manifest from "../generated/content-manifest.json";
import { createSectionHref, locales, sectionLandingSections } from "../lib/content-model";
import robots from "./robots";
import sitemap from "./sitemap";

describe("documentation metadata routes", () => {
  it("generates every localized document and section landing", () => {
    const entries = sitemap();
    const documentEntries = entries.slice(0, manifest.length);
    expect(documentEntries.map(({ url }) => url)).toEqual(
      manifest.map(({ href }) => `https://jongminchung.dev${href}`),
    );

    for (const entry of documentEntries) {
      const document = manifest.find(({ href }) => `https://jongminchung.dev${href}` === entry.url);
      if (document === undefined) throw new Error(`Missing sitemap source for ${entry.url}.`);
      expect(entry.lastModified).toBe(document.updatedAt);
      expect(entry.alternates?.languages).toEqual({
        ko: `https://jongminchung.dev/ko/${document.id}`,
        en: `https://jongminchung.dev/en/${document.id}`,
      });
    }

    const sectionEntries = entries.slice(manifest.length);
    expect(sectionEntries.map(({ url }) => url)).toEqual(
      locales.flatMap((locale) =>
        sectionLandingSections.map(
          (section) => `https://jongminchung.dev${createSectionHref(locale, section)}`,
        ),
      ),
    );
    for (const entry of sectionEntries) {
      expect(entry.alternates?.languages).toEqual({
        ko: entry.url.replace(/\/en\//u, "/ko/"),
        en: entry.url.replace(/\/ko\//u, "/en/"),
      });
    }
  });

  it("publishes the generated sitemap to crawlers", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: "https://jongminchung.dev/sitemap.xml",
    });
  });
});
