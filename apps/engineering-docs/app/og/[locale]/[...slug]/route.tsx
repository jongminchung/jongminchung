import { ImageResponse } from "next/og";
import {
    type DocSection,
    isLocale,
    locales,
    sectionLandingSections,
} from "#lib/content-model";
import { documents, findDocument } from "#lib/documents";
import { findSectionPage } from "#lib/section-pages";

interface RouteContext {
    readonly params: Promise<{
        readonly locale: string;
        readonly slug: readonly string[];
    }>;
}

interface OgPageData {
    readonly title: string;
    readonly section: DocSection;
    readonly updatedAt: string;
    readonly detail: string;
}

interface StaticOgParam {
    readonly locale: string;
    readonly slug: readonly string[];
}

const sectionLabels: Readonly<Record<DocSection, string>> = {
    overview: "Overview",
    handbook: "Handbook",
    packages: "Packages",
    "deep-dive": "Deep Dive",
};

function resolvePage(
    locale: string,
    slug: readonly string[],
): OgPageData | null {
    if (!isLocale(locale)) return null;
    const id = slug.join("/");
    const sectionPage = findSectionPage(locale, id);
    if (sectionPage !== null) {
        return {
            title: sectionPage.title,
            section: sectionPage.section,
            updatedAt: sectionPage.updatedAt,
            detail: `${sectionPage.documents.length} documents`,
        };
    }
    const document = findDocument(locale, id);
    if (document === null) return null;
    return {
        title: document.title,
        section: document.section,
        updatedAt: document.updatedAt,
        detail: document.status,
    };
}

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): StaticOgParam[] {
    const documentParams = documents.map((document) => ({
        locale: document.locale,
        slug: document.id.split("/"),
    }));
    const sectionParams = locales.flatMap((locale) =>
        sectionLandingSections.map((section) => ({ locale, slug: [section] })),
    );
    return [...documentParams, ...sectionParams];
}

export async function GET(
    _request: Request,
    context: RouteContext,
): Promise<Response> {
    const { locale, slug } = await context.params;
    const page = resolvePage(locale, slug);
    if (page === null) return new Response("Not found", { status: 404 });
    const titleSize = page.title.length > 38 ? 48 : 58;
    return new ImageResponse(
        <div
            style={{
                position: "relative",
                display: "flex",
                width: "100%",
                height: "100%",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                padding: "54px 60px 58px",
                background:
                    "radial-gradient(ellipse 620px 360px at 78% -8%, rgba(96,70,232,0.22), transparent), radial-gradient(ellipse 520px 340px at 12% 5%, rgba(111,184,255,0.15), transparent), #fbfaff",
                color: "#211f2d",
                fontFamily: "sans-serif",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    display: "flex",
                    width: 430,
                    height: "100%",
                    borderLeft: "1px solid rgba(96,70,232,0.12)",
                }}
            >
                {[1, 2, 3].map((line) => (
                    <span
                        key={line}
                        style={{
                            width: 107,
                            height: "100%",
                            borderRight: "1px solid rgba(96,70,232,0.12)",
                        }}
                    />
                ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span
                    style={{
                        display: "flex",
                        width: 44,
                        height: 44,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 11,
                        background: "#6046e8",
                        boxShadow: "inset 0 0 0 8px #ddd7ff",
                    }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 22, fontWeight: 700 }}>
                        Jongmin Chung
                    </span>
                    <span
                        style={{
                            marginTop: 2,
                            color: "#716d7c",
                            fontSize: 14,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                        }}
                    >
                        Engineering Docs
                    </span>
                </div>
            </div>
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    width: 930,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 18,
                    }}
                >
                    <span
                        style={{
                            display: "flex",
                            padding: "7px 13px",
                            borderRadius: 7,
                            background: "#eeeafe",
                            color: "#6046e8",
                            fontSize: 15,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                        }}
                    >
                        {sectionLabels[page.section]}
                    </span>
                    <span style={{ color: "#716d7c", fontSize: 15 }}>
                        {page.detail}
                    </span>
                    <span style={{ color: "#aaa6b3", fontSize: 15 }}>·</span>
                    <span style={{ color: "#716d7c", fontSize: 15 }}>
                        {page.updatedAt}
                    </span>
                </div>
                <span
                    style={{
                        fontSize: titleSize,
                        fontWeight: 700,
                        lineHeight: 1.24,
                        letterSpacing: "-0.035em",
                        wordBreak: "keep-all",
                    }}
                >
                    {page.title}
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
