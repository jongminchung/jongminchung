import type { Locale } from "../content-contracts.ts";
import {
  notesBySource,
  publishedInvestmentNotes,
  readContentSnapshot,
  renderInvestmentMdx,
} from "../content-repository.ts";
import type {
  InvestmentNoteManifestEntry,
  InvestmentSourceKind,
} from "./content.ts";

/** `getInvestmentNotes` 데이터를 조회함 */
export async function getInvestmentNotes(
  locale: Locale,
): Promise<readonly InvestmentNoteManifestEntry[]> {
  return publishedInvestmentNotes(
    (await readContentSnapshot()).investmentNotes,
    locale,
  );
}

/** `getNotesBySource` 데이터를 조회함 */
export async function getNotesBySource(
  locale: Locale,
  kind: InvestmentSourceKind,
): Promise<readonly InvestmentNoteManifestEntry[]> {
  return notesBySource(
    (await readContentSnapshot()).investmentNotes,
    locale,
    kind,
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
  const Content = (await renderInvestmentMdx(locale, id))
    .default as React.ComponentType;
  return Object.freeze({ metadata, Content });
}
