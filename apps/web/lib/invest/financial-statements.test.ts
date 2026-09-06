import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { locales } from "../site-routing.ts";
import {
  loadInvestmentContent,
  readInvestmentNoteCollection,
} from "./source.ts";

describe("재무제표·주식 가치평가 시리즈 읽기 계약", () => {
  for (const locale of locales) {
    it(`${locale}: 모든 목차가 공개 본문과 실제 출처 각주로 연결됨`, async () => {
      const notes = readInvestmentNoteCollection();
      const chapters = notes
        .filter(
          (note) =>
            note.locale === locale &&
            note.series === "Financial Statements to Stock Valuation",
        )
        .toSorted((left, right) => left.id.localeCompare(right.id));
      expect(chapters).toHaveLength(12);
      for (const [index, chapter] of chapters.entries()) {
        expect(chapter.id).toStartWith(
          `financial-statements-${String(index + 1).padStart(2, "0")}-`,
        );
        const note = notes.find(
          (entry) => entry.locale === locale && entry.id === chapter.id,
        );
        const compiled = await loadInvestmentContent(locale, chapter.id);
        if (note === undefined || compiled === null)
          throw new Error(`Missing chapter: ${chapter.id}`);
        expect(note.status).toBe("published");
        expect(note.series).toBe("Financial Statements to Stock Valuation");
        const window = new Window();
        try {
          const document = window.document;
          document.body.innerHTML = renderToStaticMarkup(
            createElement(compiled.body),
          );
          for (const neighbor of [chapters[index - 1], chapters[index + 1]]) {
            if (neighbor !== undefined) {
              expect(
                document.querySelector(
                  `a[href="/${locale}/notes/${neighbor.id}"]`,
                ),
              ).not.toBeNull();
            }
          }
          expect(
            document.querySelector(
              `a[href="/${locale}/series/financial-statements-to-stock-valuation"]`,
            ),
          ).not.toBeNull();
          if (index === 0) {
            for (const entry of chapters) {
              expect(
                document.querySelector(
                  `a[href="/${locale}/notes/${entry.id}"]`,
                ),
              ).not.toBeNull();
            }
          }
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
