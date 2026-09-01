import { EditorialIndex } from "#components/EditorialIndex";
import { StructuredData } from "#components/StructuredData";
import {
  parseEditorialQuery,
  type EditorialSearchParams,
} from "#lib/editorial";
import { toInvestmentEditorialItem } from "#lib/editorial-adapters";
import type { InvestmentNoteManifestEntry } from "#lib/invest/content";
import { getInvestmentMessages } from "#lib/invest/copy";
import type { Locale } from "#lib/site-routing";
import { createInvestmentCollectionStructuredData } from "#lib/structured-data";

/** 필터 가능한 Invest collection을 렌더링함 */
export function InvestmentCollection({
  locale,
  notes,
  pathname,
  title,
  description,
  searchParams,
}: {
  readonly locale: Locale;
  readonly notes: readonly InvestmentNoteManifestEntry[];
  readonly pathname: string;
  readonly title: string;
  readonly description: string;
  readonly searchParams: EditorialSearchParams;
}): React.JSX.Element {
  const copy = {
    ...getInvestmentMessages(locale).index,
    title,
    description,
  };
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
        pagination="links"
        query={parseEditorialQuery(
          searchParams,
          items.flatMap((item) => item.tags),
        )}
        variant="default"
      />
    </>
  );
}
