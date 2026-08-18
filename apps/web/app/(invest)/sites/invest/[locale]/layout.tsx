import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { InvestmentLayout } from "#components/invest/InvestmentShell";
import { ThemeProvider } from "#components/ThemeProvider";
import { isLocale } from "#lib/site-routing";
import { themeStorageKeys } from "#lib/theme";
import { InitialThemeScript, pretendard } from "../../../../root-layout";
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

/** `InvestmentLocaleLayout` 페이지 UI를 렌더링함 */
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
        <html
            lang={locale}
            className={pretendard.variable}
            data-theme="light"
            suppressHydrationWarning
        >
            <head>
                <InitialThemeScript storageKey={themeStorageKeys.invest} />
            </head>
            <body data-site="invest">
                <ThemeProvider storageKey={themeStorageKeys.invest}>
                    <TooltipProvider>
                        <InvestmentLayout locale={locale}>
                            {children}
                        </InvestmentLayout>
                    </TooltipProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
