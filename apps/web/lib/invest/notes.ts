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
export async function getInvestmentNotes(
  locale: Locale,
): Promise<readonly InvestmentNoteManifestEntry[]> {
  return publishedInvestmentNotes(
    readContentSnapshot().investmentNotes,
    locale,
  );
}

/** `getNotesBySource` 데이터를 조회함 */
export async function getNotesBySource(
  locale: Locale,
  kind: InvestmentSourceKind,
): Promise<readonly InvestmentNoteManifestEntry[]> {
  return notesBySource(readContentSnapshot().investmentNotes, locale, kind);
}

/** `getNotesByTag` tag에 속한 공개 투자 노트를 반환함 */
export async function getNotesByTag(
  locale: Locale,
  tag: string,
): Promise<readonly InvestmentNoteManifestEntry[]> {
  return (await getInvestmentNotes(locale)).filter((note) =>
    note.tags.includes(tag),
  );
}

/** `getNotesBySeriesSlug` URL slug에 해당하는 투자 series 노트를 반환함 */
export async function getNotesBySeriesSlug(
  locale: Locale,
  slug: string,
): Promise<readonly InvestmentNoteManifestEntry[]> {
  const normalizedSlug = investmentSeriesSlug(slug);
  return (await getInvestmentNotes(locale)).filter(
    (note) =>
      note.series !== undefined &&
      investmentSeriesSlug(note.series) === normalizedSlug,
  );
}

/** `findInvestmentNote` 데이터를 조회함 */
export async function findInvestmentNote(locale: Locale, id: string) {
  return (
    (await getInvestmentNotes(locale)).find((note) => note.id === id) ?? null
  );
}

/** `loadInvestmentNote` 데이터를 조회함 */
export async function loadInvestmentNote(locale: Locale, id: string) {
  const metadata = await findInvestmentNote(locale, id);
  if (metadata === null) return null;
  const compiled = await loadInvestmentContent(locale, id);
  if (compiled === null)
    throw new Error(`Missing compiled investment note ${locale}/${id}.`);
  return Object.freeze({ metadata, Content: compiled.body });
}
