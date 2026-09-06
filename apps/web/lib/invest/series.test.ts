import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { locales } from "../site-routing.ts";
import { getInvestmentSeriesGuide } from "./series.ts";
import {
  loadInvestmentContent,
  readInvestmentNoteCollection,
} from "./source.ts";

describe("삶을 위한 경제·금융 시리즈 읽기 계약", () => {
  for (const locale of locales) {
    it(`${locale}: 모든 목차가 공개 본문과 실제 출처 각주로 연결됨`, async () => {
      const guide = getInvestmentSeriesGuide(locale);
      const notes = readInvestmentNoteCollection();
      expect(guide.chapters).toHaveLength(8);
      for (const chapter of guide.chapters) {
        const note = notes.find(
          (entry) => entry.locale === locale && entry.id === chapter.id,
        );
        const compiled = await loadInvestmentContent(locale, chapter.id);
        if (note === undefined || compiled === null)
          throw new Error(`Missing chapter: ${chapter.id}`);
        expect(note.status).toBe("published");
        expect(note.series).toBe("Economics and Finance for Life");
        const window = new Window();
        try {
          const document = window.document;
          document.body.innerHTML = renderToStaticMarkup(
            createElement(compiled.body),
          );
          const references = document.querySelectorAll("a[data-footnote-ref]");
          expect(references.length).toBeGreaterThan(0);
          const sourceUrls = new Set(note.sources.map(({ url }) => url));
          for (const reference of references) {
            const href = reference.getAttribute("href");
            if (href === null) throw new Error("Missing footnote target");
            const footnote = document.getElementById(
              decodeURIComponent(href.slice(1)),
            );
            if (footnote === null) throw new Error(`Broken footnote: ${href}`);
            const source = footnote.querySelector('a[href^="https://"]');
            expect(sourceUrls.has(source?.getAttribute("href") ?? "")).toBe(
              true,
            );
            const backref = footnote.querySelector("a[data-footnote-backref]");
            expect(backref).not.toBeNull();
          }
          expect(
            document.querySelector(`a[href="/${locale}/series"]`),
          ).not.toBeNull();
        } finally {
          await window.happyDOM.close();
        }
      }
    });
  }
});
