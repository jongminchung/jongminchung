import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { ReactNode } from "react";
import { EditorialFooter, EditorialHeader } from "#components/Editorial";
import { ThemeControl } from "#components/ThemeControl";
import type { Locale } from "#lib/content-model";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SearchProvider, SearchTrigger } from "./SearchPalette";

/** `DocsShell` 블로그와 시리즈의 공통 셸을 렌더링함 */
export function DocsShell({
  locale,
  alternateHref,
  children,
}: {
  readonly locale: Locale;
  readonly alternateHref: string;
  readonly children: ReactNode;
}) {
  const labels =
    locale === "ko"
      ? { blog: "블로그", series: "시리즈", showcase: "쇼케이스" }
      : { blog: "Blog", series: "Series", showcase: "Showcase" };
  return (
    <SearchProvider locale={locale}>
      <TooltipProvider>
        <div className="min-h-dvh bg-background">
          <EditorialHeader
            actions={
              <>
                <SearchTrigger compact />
                <ThemeControl locale={locale} />
              </>
            }
            brand={
              <>
                <span>jongminchung</span>
                <span className="ml-1 align-top text-[9px]">tech</span>
              </>
            }
            brandLabel="jongminchung tech"
            homeHref={`/${locale}`}
            localeControl={
              <LocaleSwitcher compact href={alternateHref} locale={locale} />
            }
            localeHref={alternateHref}
            localeLabel={locale === "ko" ? "EN" : "KO"}
            navigation={[
              { href: `/${locale}`, label: labels.blog },
              { href: `/${locale}/series`, label: labels.series },
              { href: `/${locale}/showcase`, label: labels.showcase },
            ]}
          />
          <div className="min-w-0">{children}</div>
          <EditorialFooter
            groups={[
              {
                label: locale === "ko" ? "탐색" : "Explore",
                links: [{ href: `/${locale}`, label: labels.blog }],
              },
              {
                label: locale === "ko" ? "모음" : "Collections",
                links: [{ href: `/${locale}/series`, label: labels.series }],
              },
              {
                label: "Feed",
                links: [{ href: `/${locale}/rss.xml`, label: "RSS" }],
              },
              {
                label: locale === "ko" ? "언어" : "Language",
                links: [
                  {
                    href: alternateHref,
                    label: locale === "ko" ? "English" : "한국어",
                  },
                ],
              },
              {
                label: "Elsewhere",
                links: [{ href: "https://jamie.kr", label: "jamie.kr ↗" }],
              },
            ]}
            note="Engineering Notes · Jamie"
          />
        </div>
      </TooltipProvider>
    </SearchProvider>
  );
}
