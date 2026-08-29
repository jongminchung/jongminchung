import { TooltipProvider } from "@jongminchung/ui/components/tooltip";
import type { ReactNode } from "react";
import { EditorialFooter, EditorialHeader } from "#components/EditorialChrome";
import { ThemeControl } from "#components/ThemeControl";
import type { Locale } from "#lib/content-model";
import { createSeriesHref } from "#lib/content-model";
import { getTechMessages } from "#lib/tech/copy";
import {
  createDocsHref,
  docsCategoryIds,
  getDocsCategory,
  type DocsCategoryId,
} from "#lib/tech/docs";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SearchProvider, SearchTrigger } from "./SearchPalette";

/** `DocsShell` 블로그와 시리즈의 공통 셸을 렌더링함 */
export function DocsShell({
  locale,
  alternateHref,
  active = "blog",
  docsCategory,
  children,
}: {
  readonly locale: Locale;
  readonly alternateHref: string;
  readonly active?: "blog" | "series" | "showcase" | "docs";
  readonly docsCategory?: DocsCategoryId;
  readonly children: ReactNode;
}) {
  const labels = getTechMessages(locale).shell;
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
            navigationLabel={labels.navigation}
            homeHref={`/${locale}`}
            localeControl={
              <LocaleSwitcher
                compact
                href={alternateHref}
                locale={locale}
                preserveCurrentPath={active === "docs"}
              />
            }
            localeHref={alternateHref}
            localeLabel={labels.alternateLocaleShort}
            navigation={[
              {
                href: `/${locale}`,
                label: labels.blog,
                isActive: active === "blog",
              },
              {
                href: createSeriesHref(locale),
                label: labels.series,
                isActive: active === "series",
              },
              {
                href: `/${locale}/showcase`,
                label: labels.showcase,
                isActive: active === "showcase",
              },
              {
                href: createDocsHref(locale),
                label: labels.docs,
                isActive: active === "docs",
                menuLabel: labels.chooseDocsArea,
                options: [
                  {
                    href: createDocsHref(locale),
                    label: labels.allDocs,
                    isActive: active === "docs" && docsCategory === undefined,
                  },
                  ...docsCategoryIds.map((id) => {
                    const category = getDocsCategory(id, locale);
                    return {
                      href: createDocsHref(locale, id),
                      label: `${category.label} · ${category.title}`,
                      isActive: active === "docs" && docsCategory === id,
                    };
                  }),
                ],
              },
            ]}
          />
          <div className="min-w-0">{children}</div>
          <EditorialFooter
            groups={[
              {
                label: labels.explore,
                links: [
                  { href: `/${locale}`, label: labels.blog },
                  { href: `/${locale}/docs`, label: labels.docs },
                ],
              },
              {
                label: labels.collections,
                links: [
                  {
                    href: createSeriesHref(locale),
                    label: labels.series,
                  },
                ],
              },
              {
                label: "Feed",
                links: [{ href: `/${locale}/rss.xml`, label: "RSS" }],
              },
              {
                label: labels.language,
                links: [
                  {
                    href: alternateHref,
                    label: labels.alternateLanguage,
                  },
                ],
              },
              {
                label: "Elsewhere",
                links: [{ href: "https://www.jamie.kr", label: "jamie.kr ↗" }],
              },
            ]}
            note="Engineering Notes · Jamie"
          />
        </div>
      </TooltipProvider>
    </SearchProvider>
  );
}
