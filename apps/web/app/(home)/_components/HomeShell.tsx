import { ArrowUpRightIcon } from "lucide-react";
import { BrandWordmark } from "#components/BrandWordmark";
import { EditorialHeader } from "#components/EditorialChrome";
import { StructuredData } from "#components/StructuredData";
import { ThemeControl } from "#components/ThemeControl";
import { getHomeContent } from "#lib/home/content";
import { themeLabelTemplateFor } from "#lib/i18n-messages";
import { alternateLocale } from "#lib/locale";
import type { Locale } from "#lib/site-routing";
import { createHomeProfileStructuredData } from "#lib/structured-data";

export function HomeHeader({ locale }: { readonly locale: Locale }) {
  const { navigation, destinations } = getHomeContent(locale);
  const alternate = alternateLocale(locale);
  return (
    <>
      <a
        className="home-skip-link bg-foreground text-background"
        href="#main-content"
      >
        {navigation.skipToContent}
      </a>
      <EditorialHeader
        brand={<BrandWordmark />}
        brandLabel="jongminchung home"
        homeHref={`/${locale}`}
        navigationLabel={navigation.label}
        navigation={[
          ...destinations.map((destination) => ({
            href: destination.href,
            label: destination.title,
          })),
          { href: "#writing", label: navigation.writing },
          { href: "#principles", label: navigation.principles },
        ]}
        localeHref={`/${alternate}`}
        localeLabel={alternate.toUpperCase()}
        localeControl={
          <a
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md font-mono text-[11px] hover:bg-muted"
            href={`/${alternate}`}
            hrefLang={alternate}
            aria-label={navigation.switchLocale}
          >
            {alternate.toUpperCase()}
          </a>
        }
        mobileMenuLabel={navigation.mobileMenu}
        mobileMenuCloseLabel={navigation.closeMenu}
        actions={
          <>
            <ThemeControl labelTemplate={themeLabelTemplateFor(locale)} />
            <a
              className="hidden min-h-11 items-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
              href="https://github.com/jongminchung"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
              <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
            </a>
          </>
        }
      />
    </>
  );
}

export function HomeFooter({ locale }: { readonly locale: Locale }) {
  const { footer, destinations } = getHomeContent(locale);
  return (
    <footer className="home-footer">
      <div className="home-container">
        <div className="home-footer-main">
          <div>
            <a
              className="home-brand"
              href={`/${locale}`}
              aria-label="jongminchung home"
            >
              <BrandWordmark compact />
            </a>
            <p>{footer.description}</p>
          </div>
          <div className="home-footer-links">
            {destinations.map((destination) => (
              <a
                className="home-text-link"
                href={destination.href}
                key={destination.id}
              >
                {destination.title}
                <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
              </a>
            ))}
            <a
              className="home-text-link"
              href="https://github.com/jongminchung"
              target="_blank"
              rel="noreferrer"
              aria-label={footer.action}
            >
              GitHub
              <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>
        <p className="home-eyebrow mt-8">© 2026 Jongmin Chung</p>
      </div>
    </footer>
  );
}

export function PersonStructuredData({ locale }: { readonly locale: Locale }) {
  return <StructuredData value={createHomeProfileStructuredData(locale)} />;
}
