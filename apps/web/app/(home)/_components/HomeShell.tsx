import { ArrowUpRightIcon } from "lucide-react";
import { BrandWordmark } from "#components/BrandWordmark";
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
      <header className="home-header bg-background/95">
        <div className="home-header-inner">
          <a
            className="home-brand"
            href={`/${locale}`}
            aria-label="jongminchung home"
          >
            <BrandWordmark />
          </a>
          <nav className="home-navigation" aria-label={navigation.label}>
            {destinations.map((destination) => (
              <a href={destination.href} key={destination.id}>
                {destination.title}
              </a>
            ))}
            <a href="#writing">{navigation.writing}</a>
            <a href="#principles">{navigation.principles}</a>
          </nav>
          <div className="home-controls">
            <a
              className="home-locale"
              href={`/${alternate}`}
              hrefLang={alternate}
              aria-label={navigation.switchLocale}
            >
              {alternate.toUpperCase()}
            </a>
            <ThemeControl labelTemplate={themeLabelTemplateFor(locale)} />
            <a
              className="home-github"
              href="https://github.com/jongminchung"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
              <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>
      </header>
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
