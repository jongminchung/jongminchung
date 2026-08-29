import { ImageResponse } from "next/og";
import {
  displayTitleFor,
  isLocale,
  locales,
  type Locale,
} from "#lib/content-model";
import {
  findBlogPost,
  findDocsPage,
  getBlogPosts,
  getDocsPages,
} from "#lib/documents";
import { getTechMessages } from "#lib/tech/copy";
import { documentKindLabel } from "#lib/tech/document-kind";
import { getSeries, isSeriesId, seriesRegistry } from "#lib/tech/series";

interface StaticOgParam {
  readonly locale: string;
  readonly slug: readonly string[];
}
interface OgPageData {
  readonly title: string;
  readonly detail: string;
  readonly label: string;
  readonly updatedAt?: string;
}

async function resolvePage(
  locale: Locale,
  slug: readonly string[],
): Promise<OgPageData | null> {
  const text = getTechMessages(locale).metadata;
  if (slug.length === 1 && slug[0] === "blog")
    return {
      title: text.blogTitle,
      detail: text.latestArticles,
      label: "Blog",
    };
  if (slug.length === 1 && slug[0] === "series")
    return {
      title: text.seriesLabel,
      detail: text.orderedCollections,
      label: "Series",
    };
  if (slug.length === 2 && slug[0] === "series" && isSeriesId(slug[1] ?? "")) {
    const series = getSeries(slug[1]!, locale);
    return series === null
      ? null
      : {
          title: series.title,
          detail: series.description,
          label: text.seriesLabel,
        };
  }
  if (slug[0] === "docs") {
    const page = await findDocsPage(locale, slug.slice(1));
    return page === null
      ? null
      : {
          title: displayTitleFor(page),
          detail: page.description,
          label:
            page.documentKind === undefined
              ? "Docs"
              : documentKindLabel(locale, page.documentKind),
          updatedAt: page.updatedAt,
        };
  }
  if (slug.length !== 1 || slug[0] === undefined) return null;
  const document = await findBlogPost(locale, slug[0]);
  return document === null
    ? null
    : {
        title: document.title,
        detail: document.status,
        label:
          document.series === undefined
            ? "Blog"
            : (getSeries(document.series, locale)?.title ?? document.series),
        updatedAt: document.updatedAt,
      };
}

/** 정적 생성에 사용할 경로 매개변수를 반환함 */
export async function generateStaticParams(): Promise<StaticOgParam[]> {
  const [blogPosts, docsPages] = await Promise.all([
    getBlogPosts(),
    getDocsPages(),
  ]);
  return [
    ...blogPosts.map((post) => ({
      locale: post.locale,
      slug: [post.id],
    })),
    ...docsPages.map((page) => ({
      locale: page.locale,
      slug: ["docs", ...page.slugs],
    })),
    ...locales.flatMap((locale) => [
      { locale, slug: ["blog"] },
      { locale, slug: ["series"] },
      ...Object.keys(seriesRegistry).map((id) => ({
        locale,
        slug: ["series", id],
      })),
    ]),
  ];
}

/** 요청에 대한 응답을 생성함 */
export async function GET(
  _request: Request,
  context: RouteContext<"/tech/og/[locale]/[...slug]">,
): Promise<Response> {
  const { locale, slug } = await context.params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  const page = await resolvePage(locale, slug);
  if (page === null) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "54px 60px 58px",
        background: "#fbfaff",
        color: "#211f2d",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>Jongmin Chung</span>
        <span
          style={{
            marginTop: 2,
            color: "#716d7c",
            fontSize: 14,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Engineering Blog
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: 930 }}>
        <span
          style={{
            color: "#6046e8",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {page.label}
        </span>
        <span
          style={{
            marginTop: 18,
            fontSize: page.title.length > 38 ? 48 : 58,
            fontWeight: 700,
            lineHeight: 1.24,
            letterSpacing: "-0.035em",
          }}
        >
          {page.title}
        </span>
        <span style={{ marginTop: 18, color: "#716d7c", fontSize: 18 }}>
          {page.detail}
          {page.updatedAt === undefined ? "" : ` · ${page.updatedAt}`}
        </span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
