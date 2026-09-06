import type { Locale } from "#lib/content-model";
import { getReadingSamples } from "#lib/reading-samples";
import { docsMdxComponents } from "#mdx-components";
import { DocsCodeBlock } from "./DocsCodeBlock";
import "../tech-document.css";

/** Server-rendered previews and literal source share one build-time MDX input. */
export async function MdxShowcase({ locale }: { readonly locale: Locale }) {
  const samples = await getReadingSamples(locale);
  const ko = locale === "ko";
  return (
    <section
      id="mdx"
      lang={locale}
      className="mt-20 scroll-mt-24 border-t border-border pt-12"
      aria-labelledby="mdx-title"
    >
      <h2 id="mdx-title" className="text-3xl font-semibold tracking-tight">
        {ko ? "MDX 읽기 도구와 작성 문법" : "MDX reading tools and syntax"}
      </h2>
      <p className="mt-4 text-muted-foreground forced-colors:text-[CanvasText]">
        {ko
          ? "미리보기를 직접 조작하고 MDX 원문을 복사해 글에 사용하세요."
          : "Try each preview and copy its MDX source into your writing."}
      </p>
      <nav
        aria-label={ko ? "MDX 기능 탐색" : "MDX features"}
        className="my-8 flex flex-wrap gap-3"
      >
        {samples.map(({ feature, title }) => (
          <a
            key={feature}
            href={`#mdx-${feature}`}
            className="rounded-md border border-border px-3 py-2 text-sm underline underline-offset-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            {title}
          </a>
        ))}
      </nav>
      <div className="space-y-14">
        {samples.map(
          ({ feature, title, purpose, caution, Content, source }) => (
            <section
              key={feature}
              id={`mdx-${feature}`}
              className="min-w-0 scroll-mt-24"
            >
              <h3 id={`mdx-${feature}-title`} className="text-xl font-semibold">
                {title}
              </h3>
              <p className="mt-2 mb-5 text-muted-foreground forced-colors:text-[CanvasText]">
                {purpose}
              </p>
              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                <div
                  data-mdx-preview={feature}
                  className="min-w-0 rounded-lg border border-border p-4 leading-7 [overflow-wrap:anywhere] sm:p-6"
                >
                  <p className="mb-5 text-sm font-medium text-muted-foreground forced-colors:text-[CanvasText]">
                    {ko ? "미리보기" : "Preview"}
                  </p>
                  <Content components={docsMdxComponents} />
                </div>
                <div
                  data-mdx-source={feature}
                  className="min-w-0 forced-colors:[&_figcaption]:text-[CanvasText]"
                >
                  <DocsCodeBlock
                    title={`${feature}.mdx`}
                    className="my-0 [&_pre]:px-4"
                  >
                    <code>{source}</code>
                  </DocsCodeBlock>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground forced-colors:text-[CanvasText]">
                <strong className="text-foreground">
                  {ko ? "작성 시 주의점: " : "Authoring note: "}
                </strong>
                {caution}
              </p>
            </section>
          ),
        )}
      </div>
    </section>
  );
}
