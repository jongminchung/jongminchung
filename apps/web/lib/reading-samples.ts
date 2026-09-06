import "server-only";
import { readingSamples } from "../.source/server";
import type { Locale } from "./content-model";

const features = [
  "highlight",
  "alerts",
  "details",
  "glossary",
  "code",
  "comparison",
  "examples",
  "expected-result",
] as const;

/** Both the public guide and test fixtures consume the same compiled examples. */
export async function getReadingSamples(locale: Locale) {
  return Promise.all(
    features.map(async (feature) => {
      const entry = readingSamples.find(
        (sample) => sample.info.path === `${locale}/${feature}.mdx`,
      );
      if (!entry)
        throw new Error(`Missing reading sample: ${locale}/${feature}`);
      const content = await entry.load();
      const source = content._exports.readingSource;
      if (typeof source !== "string")
        throw new Error(`Missing MDX source: ${entry.info.path}`);
      return {
        feature,
        title: entry.title,
        purpose: entry.purpose,
        caution: entry.caution,
        Content: content.body,
        source,
      };
    }),
  );
}
