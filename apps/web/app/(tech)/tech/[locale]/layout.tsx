import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { StructuredData } from "#components/StructuredData";
import { ThemeProvider } from "#components/ThemeProvider";
import { isLocale } from "#lib/content-model";
import { messagesFor } from "#lib/i18n-messages";
import { createWebsiteStructuredData, techOrigin } from "#lib/structured-data";
import { themeStorageKeys } from "#lib/theme";
import { pretendard, rootMetadata } from "../../../root-layout";
import "../../tech.css";

export const metadata: Metadata = rootMetadata;
export const instant = false;

/** `LocaleLayout` 페이지 UI를 렌더링함 */
export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/tech/[locale]">): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      className={pretendard.variable}
      data-site="tech"
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <StructuredData
          value={createWebsiteStructuredData({
            origin: techOrigin,
            name: "Engineering Notes",
            description:
              locale === "ko"
                ? "소프트웨어를 이해하기 쉽게 만드는 기술 문서와 글"
                : "Engineering documentation and articles about building understandable software.",
            locale,
          })}
        />
        <NextIntlClientProvider locale={locale} messages={messagesFor(locale)}>
          <ThemeProvider storageKey={themeStorageKeys.tech}>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
