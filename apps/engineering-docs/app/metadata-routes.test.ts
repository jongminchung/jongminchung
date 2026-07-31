import { describe, expect, it } from "vitest";
import manifest from "../generated/content-manifest.json";
import robots from "./robots";
import sitemap from "./sitemap";

describe("documentation metadata routes", () => {
  it("generates every localized document from the content manifest", () => {
    const entries = sitemap();
    expect(entries.map(({ url }) => url)).toEqual(
      manifest.map(({ href }) => `https://jongminchung.dev${href}`),
    );

    for (const entry of entries) {
      const document = manifest.find(({ href }) => `https://jongminchung.dev${href}` === entry.url);
      if (document === undefined) throw new Error(`Missing sitemap source for ${entry.url}.`);
      expect(entry.lastModified).toBe(document.updatedAt);
      expect(entry.alternates?.languages).toEqual({
        ko: `https://jongminchung.dev/ko/${document.id}`,
        en: `https://jongminchung.dev/en/${document.id}`,
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
