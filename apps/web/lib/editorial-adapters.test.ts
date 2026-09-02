import { describe, expect, it } from "vitest";
import { getLocalizedDocsPages, getLocalizedDocuments } from "./documents";
import {
  toInvestmentEditorialItem,
  toTechEditorialItem,
} from "./editorial-adapters";
import { getInvestmentNotes } from "./invest/notes";

describe("editorial data adapter", () => {
  it("[성공] 기술 문서를 공통 editorial 항목 계약으로 변환함", async () => {
    const document = (await getLocalizedDocuments("en")).find(
      ({ contentType }) => contentType === "blog",
    );
    if (document === undefined) throw new Error("Missing tech fixture.");
    expect(toTechEditorialItem(document, "en")).toMatchObject({
      id: document.id,
      href: document.href,
      publishedAt: document.publishedAt,
      tags: expect.arrayContaining([...document.tags]),
      image: {
        srcLight: `/tech/articles/${document.id}.light.png`,
        srcDark: `/tech/articles/${document.id}.dark.png`,
        alt: document.displayTitle ?? document.title,
      },
    });
  });

  it("[성공] Diátaxis 문서 유형을 표시하고 tag filter에 노출함", async () => {
    const document = (await getLocalizedDocsPages("ko")).find(
      ({ id }) => id === "tutorial-maintainable-tailwind-shadcn",
    );
    if (document === undefined) throw new Error("Missing tutorial fixture.");
    const item = toTechEditorialItem(document, "ko");
    expect(item.kind).toBe("튜토리얼");
    expect(item.tags).toContain("tutorial");
    expect(item.image).toBeUndefined();
  });

  it("[성공] 투자 노트가 source kind를 포함한 공통 editorial 항목으로 변환됨", () => {
    const note = getInvestmentNotes("en")[0];
    if (note === undefined) throw new Error("Missing investment fixture.");
    const item = toInvestmentEditorialItem(note);
    expect(item).toMatchObject({
      id: note.id,
      href: note.href,
      publishedAt: note.publishedAt,
      image: {
        srcLight: note.image,
        srcDark: note.imageDark,
        alt: note.imageAlt,
      },
    });
    expect(item.tags).toEqual(
      expect.arrayContaining(note.sources.map(({ kind }) => kind)),
    );
  });
});
