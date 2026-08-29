import { EditorialIndex } from "#components/EditorialIndex";
import {
  documentKinds,
  type ContentManifestEntry,
  type Locale,
} from "#lib/content-model";
import {
  parseEditorialQuery,
  type EditorialCopy,
  type EditorialSearchParams,
} from "#lib/editorial";
import { toTechEditorialItem } from "#lib/editorial-adapters";
import { documentKindLabel } from "#lib/tech/document-kind";

const copy: Record<Locale, EditorialCopy> = {
  ko: {
    eyebrow: "ENGINEERING NOTES",
    title: "Engineering",
    description: "소프트웨어를 만드는 기술과 사람에 관한 글",
    all: "모든 글",
    newest: "최신순",
    oldest: "오래된순",
    grid: "그리드",
    list: "목록",
    loadMore: "더 보기",
    end: "모든 글을 불러왔습니다",
    empty: "선택한 조건과 일치하는 글이 없습니다",
    related: "관련 글",
    controls: "글 목록 제어",
  },
  en: {
    eyebrow: "ENGINEERING NOTES",
    title: "Engineering",
    description:
      "Stories about the technology and people building understandable software.",
    all: "All articles",
    newest: "Newest",
    oldest: "Oldest",
    grid: "Grid",
    list: "List",
    loadMore: "Load more",
    end: "All articles loaded",
    empty: "No articles match the selected filters.",
    related: "Related articles",
    controls: "Article list controls",
  },
};

/** `BlogIndex` URL 동기화 editorial 기술 글 목록을 렌더링함 */
export function BlogIndex({
  locale,
  documents,
  searchParams = {},
}: {
  readonly locale: Locale;
  readonly documents: readonly ContentManifestEntry[];
  readonly searchParams?: EditorialSearchParams;
}): React.JSX.Element {
  const items = documents.map((document) =>
    toTechEditorialItem(document, locale),
  );
  return (
    <EditorialIndex
      copy={copy[locale]}
      items={items}
      pathname={`/${locale}`}
      pagination="infinite"
      promotedTags={documentKinds}
      query={parseEditorialQuery(
        searchParams,
        items.flatMap((item) => item.tags),
      )}
      tagLabels={Object.fromEntries(
        documentKinds.map((kind) => [kind, documentKindLabel(locale, kind)]),
      )}
      variant="engineering"
    />
  );
}
