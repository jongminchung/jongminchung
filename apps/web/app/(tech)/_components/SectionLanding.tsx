import type { SectionPage } from "#lib/tech/section-pages";
import { DocumentCard } from "./DocumentCard";

const copy = {
  ko: {
    collection: "문서 컬렉션",
    latest: "최근 업데이트",
    all: "모든 문서",
  },
  en: {
    collection: "Documentation collection",
    latest: "Recently updated",
    all: "All documents",
  },
} as const;

/** `SectionLandingPage` 페이지 UI를 렌더링함 */
export function SectionLandingPage({
  page,
}: {
  readonly page: SectionPage;
}): React.JSX.Element {
  if (page.documents[0] === undefined)
    throw new Error(`Missing documents for ${page.locale}/${page.section}.`);
  const text = copy[page.locale];
  return (
    <div
      className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(64px,9vw,112px)] pb-24 max-[680px]:px-4 max-[680px]:pt-12 max-[680px]:pb-[72px]"
      lang={page.locale}
    >
      <header className="mb-12 max-w-[680px]">
        <p className="font-mono text-[11px] font-medium tracking-[.12em] text-primary uppercase">
          {text.collection}
        </p>
        <h1 className="mt-4 mb-3 text-[clamp(42px,5vw,68px)] leading-[1] font-medium tracking-[-.05em]">
          {page.title}
        </h1>
        <p className="m-0 max-w-[620px] text-[16px] leading-[1.55] text-muted-foreground">
          {page.description}
        </p>
      </header>
      <section aria-labelledby="all-documents">
        <h2
          className="mt-0 mb-5 font-mono text-[11px] font-medium tracking-[.08em] text-muted-foreground uppercase"
          id="all-documents"
        >
          {text.all}
        </h2>
        <div
          className="grid grid-cols-3 gap-x-5 gap-y-9 max-[840px]:grid-cols-2 max-[560px]:grid-cols-1"
          data-document-grid="true"
        >
          {page.documents.map((document, index) => (
            <DocumentCard
              document={document}
              eager={index < 3}
              key={document.id}
              locale={page.locale}
              variant="related"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
