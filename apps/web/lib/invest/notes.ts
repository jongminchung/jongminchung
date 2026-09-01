import type { Locale } from "../content-contracts.ts";
import {
  notesBySource,
  publishedInvestmentNotes,
  readContentSnapshot,
} from "../content-repository.ts";
import type {
  InvestmentNoteManifestEntry,
  InvestmentSourceKind,
} from "./content.ts";
import { investmentSeriesSlug } from "./routing.ts";
import { loadInvestmentContent } from "./source.ts";

/** `getInvestmentNotes` 데이터를 조회함 */
export function getInvestmentNotes(
  locale: Locale,
): readonly InvestmentNoteManifestEntry[] {
  return publishedInvestmentNotes(
    readContentSnapshot().investmentNotes,
    locale,
  );
}

/** `getNotesBySource` 데이터를 조회함 */
export function getNotesBySource(
  locale: Locale,
  kind: InvestmentSourceKind,
): readonly InvestmentNoteManifestEntry[] {
  return notesBySource(readContentSnapshot().investmentNotes, locale, kind);
}

/** `getNotesByTag` tag에 속한 공개 투자 노트를 반환함 */
export function getNotesByTag(
  locale: Locale,
  tag: string,
): readonly InvestmentNoteManifestEntry[] {
  return getInvestmentNotes(locale).filter((note) => note.tags.includes(tag));
}

/** `getNotesBySeriesSlug` URL slug에 해당하는 투자 series 노트를 반환함 */
export function getNotesBySeriesSlug(
  locale: Locale,
  slug: string,
): readonly InvestmentNoteManifestEntry[] {
  const normalizedSlug = investmentSeriesSlug(slug);
  return getInvestmentNotes(locale).filter(
    (note) =>
      note.series !== undefined &&
      investmentSeriesSlug(note.series) === normalizedSlug,
  );
}

/** `findInvestmentNote` 데이터를 조회함 */
export function findInvestmentNote(locale: Locale, id: string) {
  return getInvestmentNotes(locale).find((note) => note.id === id) ?? null;
}

/** `loadInvestmentNote` 데이터를 조회함 */
export async function loadInvestmentNote(locale: Locale, id: string) {
  const metadata = findInvestmentNote(locale, id);
  if (metadata === null) return null;
  const compiled = await loadInvestmentContent(locale, id);
  if (compiled === null)
    throw new Error(`Missing compiled investment note ${locale}/${id}.`);
  return Object.freeze({
    metadata,
    Content: compiled.body,
    toc: compiled.toc,
  });
}
