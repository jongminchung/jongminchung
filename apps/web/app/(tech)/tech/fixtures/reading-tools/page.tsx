import { notFound } from "next/navigation";
import { getReadingSamples } from "#lib/reading-samples";
import { articleMdxComponents, docsMdxComponents } from "#mdx-components";
import "../../../tech-document.css";

/** 실제 MDX 컴파일부터 Docs/Article 소비까지 검사하며 공개 목록에는 포함하지 않음. */
export default async function ReadingToolsFixture({
  searchParams,
}: {
  readonly searchParams: Promise<{ locale?: string; mode?: string }>;
}) {
  if (process.env.PLAYWRIGHT_TEST !== "1") notFound();
  const query = await searchParams;
  const locale = query.locale === "en" ? "en" : "ko";
  const samples = await getReadingSamples(locale);
  return (
    <main
      lang={locale}
      className="mx-auto max-w-3xl px-4 py-10 text-base leading-7"
    >
      <h1 className="mb-8 text-2xl font-semibold">
        {locale === "ko" ? "MDX 읽기 도구" : "MDX reading tools"}
      </h1>
      {samples.map(({ feature, Content }) => (
        <Content
          key={feature}
          components={
            query.mode === "article" ? articleMdxComponents : docsMdxComponents
          }
        />
      ))}
    </main>
  );
}
