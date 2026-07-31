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
      apiSymbols: ["example#run"],
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
    expect(Object.isFrozen(metadata.apiSymbols)).toBe(true);
  });

  it("rejects unsupported locales, fields, IDs, and sections", () => {
    expect(() => parseDocMetadata({ ...validMetadata, locale: "fr" })).toThrow(
      'unsupported locale "fr"',
    );
    expect(() => parseDocMetadata({ ...validMetadata, typo: true })).toThrow(
      "unsupported metadata fields: typo",
    );
    expect(() => parseDocMetadata({ ...validMetadata, id: "Overview" })).toThrow(
      "must be a lowercase path",
    );
    expect(() =>
      parseDocMetadata({ ...validMetadata, id: "packages/tooling", section: "handbook" }),
    ).toThrow('does not belong to section "handbook"');
  });

  it.each(["14-07-2026", "2026-02-29", "2026-04-31"])(
    "rejects the invalid calendar date %s",
    (updatedAt) => {
      expect(() => parseDocMetadata({ ...validMetadata, updatedAt })).toThrow(
        "must be an ISO date",
      );
    },
  );

  it("accepts leap days and rejects verification before the update", () => {
    expect(
      parseDocMetadata({
        ...validMetadata,
        updatedAt: "2024-02-29",
        verifiedAt: "2024-02-29",
      }).verifiedAt,
    ).toBe("2024-02-29");
    expect(() =>
      parseDocMetadata({
        ...validMetadata,
        updatedAt: "2026-07-14",
        verifiedAt: "2026-07-13",
      }),
    ).toThrow('must not precede "updatedAt"');
  });

  it.each([
    "http://example.com/source",
    "https://user:secret@example.com/source",
    "javascript:alert(1)",
  ])("rejects the unsafe source URL %s", (sourceUrl) => {
    expect(() => parseDocMetadata({ ...validMetadata, sourceUrl })).toThrow(
      /absolute URL|credential-free HTTPS URL/u,
    );
  });

  it("rejects empty and duplicate metadata arrays", () => {
    expect(() => parseDocMetadata({ ...validMetadata, tags: [] })).toThrow(
      "must be an array of strings",
    );
    expect(() => parseDocMetadata({ ...validMetadata, tags: ["docs", " docs "] })).toThrow(
      "must not contain duplicates",
    );
    expect(() => parseDocMetadata({ ...validMetadata, apiSymbols: [""] })).toThrow(
      "must not contain empty strings",
    );
  });
});
