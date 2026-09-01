import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "#components/ThemeProvider";
import { themeStorageKeys } from "#lib/theme";
import { pretendard, rootMetadata } from "../../../root-layout";
import "../../tech.css";

export const metadata: Metadata = {
  ...rootMetadata,
  robots: { index: false, follow: false },
};
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
        <ThemeProvider storageKey={themeStorageKeys.tech}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
