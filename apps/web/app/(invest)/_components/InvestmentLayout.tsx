import type { ReactNode } from "react";
import { BrandWordmark } from "#components/BrandWordmark";
import { EditorialFooter, EditorialHeader } from "#components/EditorialChrome";
import { ThemeControl } from "#components/ThemeControl";
import { getInvestmentMessages } from "#lib/invest/copy";
import { alternateLocale } from "#lib/locale";
import type { Locale } from "#lib/site-routing";

/** Invest 도메인의 공통 header와 footer를 렌더링함 */
export function InvestmentLayout({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}): React.JSX.Element {
  const text = getInvestmentMessages(locale).layout;
  const alternate = alternateLocale(locale);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <EditorialHeader
        actions={<ThemeControl locale={locale} />}
        brand={<BrandWordmark suffix="invest" />}
        brandLabel="jongminchung invest"
        navigationLabel={text.navigation}
        homeHref={`/${locale}`}
        localeHref={`/${alternate}`}
        localeLabel={alternate.toUpperCase()}
        navigation={[
          { href: `/${locale}/notes`, label: text.notes },
          { href: `/${locale}/sources/book`, label: text.books },
        ]}
      />
      {children}
      <EditorialFooter
        groups={[
          {
            label: text.explore,
            links: [
              { href: `/${locale}`, label: "Home" },
              { href: `/${locale}/notes`, label: text.notes },
            ],
          },
          {
            label: text.sources,
            links: [
              { href: `/${locale}/sources/book`, label: text.books },
              { href: `/${locale}/rss.xml`, label: "RSS" },
            ],
          },
          {
            label: "Elsewhere",
            links: [{ href: "https://www.jamie.kr", label: "jamie.kr ↗" }],
          },
        ]}
        note="Independent investment research · Not investment advice"
      />
    </div>
  );
}
