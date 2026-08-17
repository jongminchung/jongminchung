import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { InvestmentLayout } from "#components/invest/InvestmentShell";
import { isLocale } from "#lib/site-routing";
import "../../../invest.css";

export const metadata: Metadata = {
    metadataBase: new URL("https://invest.jamie.kr"),
    title: { default: "Investment Notes", template: "%s · Investment Notes" },
    description:
        "Source-grounded investment research notes that separate summary from personal judgment.",
    openGraph: {
        siteName: "Investment Notes",
        type: "website",
        images: [
            {
                url: "/investment-notes-og.png",
                width: 1200,
                height: 630,
                alt: "Investment Notes research journal",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        images: ["/investment-notes-og.png"],
    },
};

export default async function InvestmentLocaleLayout({
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
            <body data-site="invest">
                <InvestmentLayout locale={locale}>{children}</InvestmentLayout>
            </body>
        </html>
    );
}
