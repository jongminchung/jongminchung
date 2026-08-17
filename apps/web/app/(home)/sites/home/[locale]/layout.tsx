import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isLocale } from "#lib/site-routing";
import "../../../home.css";

export const metadata: Metadata = {
    metadataBase: new URL("https://jamie.kr"),
    title: "Jamie — Jongmin Chung",
    description:
        "Jongmin Chung builds software that turns shared language into clear models, public APIs, and verifiable change.",
    openGraph: {
        title: "Jamie — Jongmin Chung",
        description: "Complex systems should explain themselves.",
        siteName: "Jamie",
        type: "website",
        images: [
            {
                url: "/og",
                width: 1200,
                height: 630,
                alt: "Jamie — Jongmin Chung",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Jamie — Jongmin Chung",
        description: "Complex systems should explain themselves.",
        images: ["/og"],
    },
};

/** `HomeLocaleLayout` 페이지 UI를 렌더링함 */
export default async function HomeLocaleLayout({
    children,
    params,
}: {
    readonly children: ReactNode;
    readonly params: Promise<{ readonly locale: string }>;
}): Promise<React.JSX.Element> {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return (
        <html lang={locale}>
            <body data-site="home">{children}</body>
        </html>
    );
}
