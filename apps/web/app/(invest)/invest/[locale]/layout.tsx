import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { StructuredData } from "#components/StructuredData";
import { ThemeProvider } from "#components/ThemeProvider";
import { InvestmentLayout } from "#invest-components/InvestmentShell";
import { messagesFor } from "#lib/i18n-messages";
import { isLocale } from "#lib/site-routing";
import {
  createWebsiteStructuredData,
  investOrigin,
} from "#lib/structured-data";
import { themeStorageKeys } from "#lib/theme";
import {
  localeFontClassName,
  pretendardStylesheetHref,
} from "../../../root-layout";
import "../../invest.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://invest.jamie.kr"),
  title: { default: "Investment Notes", template: "%s · Investment Notes" },
  description:
    "Investment essays grounded in 13F filings, books, interviews, and original sources.",
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
export const instant = false;

/** `InvestmentLocaleLayout` 페이지 UI를 렌더링함 */
export default async function InvestmentLocaleLayout({
  children,
  params,
}: LayoutProps<"/invest/[locale]">): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
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
            origin: investOrigin,
            name: "Investment Notes",
            description:
              locale === "ko"
                ? "13F 공시, 책, 인터뷰와 투자 원문을 바탕으로 작성한 투자 리서치 글"
                : "Investment essays grounded in 13F filings, books, interviews, and original sources.",
            locale,
          })}
        />
        <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
          <ThemeProvider storageKey={themeStorageKeys.invest}>
            <TooltipProvider>
              <InvestmentLayout locale={locale}>{children}</InvestmentLayout>
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
