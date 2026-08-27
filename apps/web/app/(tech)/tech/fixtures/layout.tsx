import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { ThemeProvider } from "#components/ThemeProvider";
import { messagesFor } from "#lib/i18n-messages";
import { themeStorageKeys } from "#lib/theme";
import { pretendard, rootMetadata } from "../../../root-layout";
import "../../tech.css";

export const metadata: Metadata = rootMetadata;
export const instant = false;

/** Playwright 전용 공용 UI fixture의 document shell을 제공함 */
export default function FixtureRootLayout({
  children,
}: {
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <html
      lang="en"
      className={pretendard.variable}
      data-site="tech"
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider locale="en" messages={messagesFor("en")}>
          <ThemeProvider storageKey={themeStorageKeys.tech}>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
