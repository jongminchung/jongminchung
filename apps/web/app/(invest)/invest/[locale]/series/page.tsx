import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { investmentSeriesDescription } from "#lib/invest/copy";
import { getInvestmentNotes } from "#lib/invest/notes";
import { createInvestmentSeriesHref } from "#lib/invest/routing";
import { createInvestmentCollectionMetadata } from "#lib/invest/seo";
import { getInvestmentSeriesGuide } from "#lib/invest/series";
import { alternateLocale } from "#lib/locale";
import { isLocale, locales } from "#lib/site-routing";

/** 시리즈 안내 페이지의 언어별 정적 경로를 생성함. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** 시리즈 안내 페이지의 검색·언어 대체 메타데이터를 생성함. */
export async function generateMetadata({
  params,
}: PageProps<"/invest/[locale]/series">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { title, description } = getInvestmentSeriesGuide(locale);
  return createInvestmentCollectionMetadata({
    locale,
    title,
    description,
    pathname: `/${locale}/series`,
    alternatePathname: `/${alternateLocale(locale)}/series`,
    index: true,
  });
}

/** 학습 목차와 현재 공개된 투자 시리즈를 안내함. */
export default async function SeriesIndex({
  params,
}: PageProps<"/invest/[locale]/series">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getInvestmentSeriesGuide(locale);
  const series = [
    ...new Set(
      getInvestmentNotes(locale).flatMap((note) =>
        note.series === undefined ? [] : [note.series],
      ),
    ),
  ];

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(56px,7vw,88px)] pb-24 max-[680px]:px-4 max-[680px]:pt-10">
      <header className="max-w-[760px]">
        <p className="text-xs font-medium tracking-[.02em] text-muted-foreground">
          SERIES
        </p>
        <h1 className="mt-4 text-[clamp(40px,5vw,56px)] leading-[1.1] font-semibold tracking-[-.04em]">
          {copy.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          {copy.description}
        </p>
      </header>
      <section aria-labelledby="curriculum-title" className="mt-14">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="curriculum-title" className="text-2xl font-semibold">
            {copy.curriculum}
          </h2>
        </div>
        <p className="mt-4 max-w-[760px] leading-relaxed text-muted-foreground">
          {copy.introduction}
        </p>
        <ol className="mt-8 grid gap-x-10 md:grid-cols-2">
          {copy.chapters.map((chapter, index) => (
            <li key={chapter.title} className="border-t py-7">
              <p
                aria-hidden="true"
                className="mb-3 font-mono text-sm text-muted-foreground"
              >
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="text-xl font-semibold">
                <Link
                  className="underline decoration-border underline-offset-4 hover:decoration-current"
                  href={`/${locale}/notes/${chapter.id}`}
                >
                  {chapter.title}
                </Link>
              </h3>
              <p className="mt-3 leading-relaxed">{chapter.question}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {chapter.topics}
              </p>
              <p className="mt-5 text-sm leading-relaxed">
                <span className="font-medium">{copy.exercise}: </span>
                {chapter.exercise}
              </p>
            </li>
          ))}
        </ol>
      </section>
      {series.length > 0 && (
        <section
          aria-labelledby="published-series-title"
          className="mt-14 border-t pt-10"
        >
          <h2 id="published-series-title" className="text-2xl font-semibold">
            {copy.published}
          </h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {series.map((name) => (
              <li key={name}>
                <Link
                  className="inline-flex min-h-11 items-center text-lg font-medium underline underline-offset-4"
                  href={createInvestmentSeriesHref(locale, name)}
                >
                  {name}
                </Link>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {investmentSeriesDescription(locale, name)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
