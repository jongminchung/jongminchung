import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "#components/StructuredData";
import { ThemeProvider } from "#components/ThemeProvider";
import { InvestmentLayout } from "#invest-components/InvestmentLayout";
import { getInvestmentMessages } from "#lib/invest/copy";
import { investmentOgImage } from "#lib/invest/seo";
import { isLocale, siteOrigins } from "#lib/site-routing";
import { createWebsiteStructuredData } from "#lib/structured-data";
import { themeStorageKeys } from "#lib/theme";
import {
  localeFontClassName,
  pretendardStylesheetHref,
} from "../../../root-layout";
import "../../invest.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigins.invest),
  title: { default: "Investment Notes", template: "%s · Investment Notes" },
  description:
    "Investment essays grounded in 13F filings, books, interviews, and original sources.",
  openGraph: {
    siteName: "Investment Notes",
    type: "website",
    images: [
      {
        url: investmentOgImage,
        width: 1200,
        height: 630,
        alt: "Investment Notes research journal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [investmentOgImage],
  },
};
export const instant = false;

/** `InvestmentLocaleLayout` 페이지 UI를 렌더링함 */
export default async function InvestmentLocaleLayout({
  children,
  params,
}: LayoutProps<"/invest/[locale]">): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = getInvestmentMessages(locale);
  return (
    <html
      lang={locale}
      className={localeFontClassName(locale)}
      data-site="invest"
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <link href={pretendardStylesheetHref} rel="stylesheet" />
      </head>
      <body>
        <StructuredData
          value={createWebsiteStructuredData({
            origin: siteOrigins.invest,
            name: "Investment Notes",
            description: text.siteDescription,
            locale,
          })}
        />
        <ThemeProvider storageKey={themeStorageKeys.invest}>
          <TooltipProvider>
            <InvestmentLayout locale={locale}>{children}</InvestmentLayout>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
