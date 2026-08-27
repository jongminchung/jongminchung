import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { ThemeProvider } from "#components/ThemeProvider";
import { InvestmentLayout } from "#invest-components/InvestmentShell";
import { messagesFor } from "#lib/i18n-messages";
import { isLocale } from "#lib/site-routing";
import { themeStorageKeys } from "#lib/theme";
import { pretendard } from "../../../root-layout";
import "../../invest.css";

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
      className={pretendard.variable}
      data-site="invest"
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
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
