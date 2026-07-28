import { describe, expect, it } from "vitest";
import { parseDocMetadata } from "./content-model";

const validMetadata = {
  id: "overview",
  locale: "en",
  section: "overview",
  title: "Overview",
  description: "Documentation overview",
  order: 0,
  updatedAt: "2026-07-14",
  tags: ["docs"],
  status: "stable",
  sourceUrl: "https://example.com/source",
};

describe("parseDocMetadata", () => {
  it("returns an immutable validated document contract", () => {
    const metadata = parseDocMetadata({
      ...validMetadata,
      displayTitle: "Overview",
      verifiedAt: "2026-07-14",
    });
    expect(metadata).toMatchObject({
      ...validMetadata,
      displayTitle: "Overview",
      verifiedAt: "2026-07-14",
    });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.tags)).toBe(true);
  });

  it("rejects unsupported locales and invalid dates", () => {
    expect(() => parseDocMetadata({ ...validMetadata, locale: "fr" })).toThrow(
      'unsupported locale "fr"',
    );
    expect(() => parseDocMetadata({ ...validMetadata, updatedAt: "14-07-2026" })).toThrow(
      "must be an ISO date",
    );
    expect(() => parseDocMetadata({ ...validMetadata, verifiedAt: "14-07-2026" })).toThrow(
      "must be an ISO date",
    );
  });
});
