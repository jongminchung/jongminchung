import { EditorialCard } from "#components/EditorialCard";
import type { ContentManifestEntry, Locale } from "#lib/content-model";
import { toTechEditorialItem } from "#lib/editorial-adapters";
import { getTechMessages } from "#lib/tech/copy";

/** `RelatedDocuments` UI 컴포넌트를 렌더링함 */
export function RelatedDocuments({
  documents,
  locale,
}: {
  readonly documents: readonly ContentManifestEntry[];
  readonly locale: Locale;
}): React.JSX.Element | null {
  if (documents.length === 0) return null;
  const title = getTechMessages(locale).article.related;
  return (
    <section
      aria-labelledby="related-documentation"
      className="mt-16 border-t pt-7"
    >
      <h2
        className="mt-0 mb-[18px] text-[22px] font-[550] tracking-[-.015em]"
        id="related-documentation"
      >
        {title}
      </h2>
      <div className="grid grid-cols-3 gap-[14px] max-[760px]:grid-cols-1">
        {documents.map((document) => (
          <EditorialCard
            item={toTechEditorialItem(document, locale)}
            key={document.id}
            variant="engineering"
          />
        ))}
      </div>
    </section>
  );
}
