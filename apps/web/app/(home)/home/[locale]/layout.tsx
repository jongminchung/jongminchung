import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeProvider } from "#components/ThemeProvider";
import { isLocale, siteOrigins } from "#lib/site-routing";
import { themeStorageKeys } from "#lib/theme";
import {
  localeFontClassName,
  pretendardStylesheetHref,
} from "../../../root-layout";
import "../../home.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigins.home),
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
export const instant = false;

/** `HomeLocaleLayout` 페이지 UI를 렌더링함 */
export default async function HomeLocaleLayout({
  children,
  params,
}: LayoutProps<"/home/[locale]">): Promise<React.JSX.Element> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      className={localeFontClassName(locale)}
      data-site="home"
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <link href={pretendardStylesheetHref} rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider storageKey={themeStorageKeys.home}>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
