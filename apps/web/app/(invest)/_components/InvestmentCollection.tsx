import { EditorialIndex } from "#components/EditorialIndex";
import { StructuredData } from "#components/StructuredData";
import {
  parseEditorialQuery,
  type EditorialCopy,
  type EditorialSearchParams,
} from "#lib/editorial";
import { toInvestmentEditorialItem } from "#lib/editorial-adapters";
import type { InvestmentNoteManifestEntry } from "#lib/invest/content";
import { getInvestmentMessages } from "#lib/invest/copy";
import type { Locale } from "#lib/site-routing";
import { createInvestmentCollectionStructuredData } from "#lib/structured-data";

function InvestmentCollection({
  locale,
  notes,
  copy,
  pathname,
  searchParams,
}: {
  readonly locale: Locale;
  readonly notes: readonly InvestmentNoteManifestEntry[];
  readonly copy: EditorialCopy;
  readonly pathname: string;
  readonly searchParams: EditorialSearchParams;
}) {
  const items = notes.map(toInvestmentEditorialItem);
  return (
    <>
      <StructuredData
        value={createInvestmentCollectionStructuredData({
          locale,
          pathname,
          title: copy.title,
          description: copy.description,
          notes,
        })}
      />
      <EditorialIndex
        copy={copy}
        items={items}
        pathname={pathname}
        query={parseEditorialQuery(
          searchParams,
          items.flatMap((item) => item.tags),
        )}
      />
    </>
  );
}

/** Invest 첫 화면 collection을 렌더링함 */
export function InvestmentHome({
  locale,
  notes,
  searchParams = {},
}: {
  readonly locale: Locale;
  readonly notes: readonly InvestmentNoteManifestEntry[];
  readonly searchParams?: EditorialSearchParams;
}): React.JSX.Element {
  return (
    <InvestmentCollection
      copy={getInvestmentMessages(locale).index}
      locale={locale}
      notes={notes}
      pathname={`/${locale}`}
      searchParams={searchParams}
    />
  );
}

/** 필터 가능한 Invest 하위 collection을 렌더링함 */
export function NoteCollection({
  locale,
  notes,
  title,
  description,
  pathname = `/${locale}/notes`,
  searchParams = {},
}: {
  readonly locale: Locale;
  readonly notes: readonly InvestmentNoteManifestEntry[];
  readonly title?: string;
  readonly description?: string;
  readonly pathname?: string;
  readonly searchParams?: EditorialSearchParams;
}): React.JSX.Element {
  const baseCopy = getInvestmentMessages(locale).index;
  return (
    <InvestmentCollection
      copy={{
        ...baseCopy,
        title: title ?? baseCopy.title,
        description: description ?? baseCopy.description,
      }}
      locale={locale}
      notes={notes}
      pathname={pathname}
      searchParams={searchParams}
    />
  );
}
