import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { NotFoundPage, notFoundCopy } from "#components/NotFoundPage";
import { ThemeProvider } from "#components/ThemeProvider";
import { messagesFor } from "#lib/i18n-messages";
import { themeStorageKeys } from "#lib/theme";
import "./(tech)/tech.css";

export const metadata: Metadata = {
  title: { absolute: notFoundCopy.en.heading },
  description: notFoundCopy.en.description,
  robots: { index: false, follow: false },
};

/** `GlobalNotFound` 공개 기능을 제공함 */
export default function GlobalNotFound(): React.JSX.Element {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale="en" messages={messagesFor("en")}>
          <ThemeProvider storageKey={themeStorageKeys.tech}>
            <NotFoundPage locale="en" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
