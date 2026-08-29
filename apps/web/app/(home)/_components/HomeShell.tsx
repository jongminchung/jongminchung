import { BrandWordmark } from "#components/BrandWordmark";
import { StructuredData } from "#components/StructuredData";
import { ThemeControl } from "#components/ThemeControl";
import { getHomeMessages } from "#lib/home/content";
import { alternateLocale } from "#lib/locale";
import type { Locale } from "#lib/site-routing";
import { createHomeProfileStructuredData } from "#lib/structured-data";

/** `HomeHeader` UI 컴포넌트를 렌더링함 */
export function HomeHeader({ locale }: { readonly locale: Locale }) {
  const text = getHomeMessages(locale).shell;
  const alternate = alternateLocale(locale);
  return (
    <>
      <a
        className="fixed top-3 left-3 z-[100] -translate-y-[160%] bg-foreground px-3.5 py-2.5 font-mono text-xs text-background transition-transform focus:translate-y-0"
        href="#main-content"
      >
        {text.skipToContent}
      </a>
      <header className="sticky top-0 z-20 flex min-h-[58px] w-full items-center justify-between bg-background/92 px-[clamp(18px,3vw,42px)] backdrop-blur-[18px] max-[720px]:min-h-16">
        <a
          className="inline-flex items-center"
          href="#top"
          aria-label="jongminchung home"
        >
          <BrandWordmark />
        </a>
        <nav
          className="flex items-center gap-[clamp(10px,1.8vw,22px)] text-[13px] max-[720px]:gap-[15px] [&_a]:relative [&_a]:after:absolute [&_a]:after:right-0 [&_a]:after:-bottom-2 [&_a]:after:left-0 [&_a]:after:h-0.5 [&_a]:after:origin-left [&_a]:after:scale-x-0 [&_a]:after:bg-primary [&_a]:after:transition-transform [&_a:hover]:after:scale-x-100 max-[720px]:[&_a:nth-child(-n+2)]:hidden"
          aria-label={text.navigation}
        >
          <a href="#work">{text.work}</a>
          <a href="#writing">{text.writing}</a>
          <a href="#principles">{text.principles}</a>
          <a href={`/${alternate}`} hrefLang={alternate}>
            {text.alternateLocaleShort}
          </a>
          <ThemeControl locale={locale} />
          <a
            href="https://github.com/jongminchung"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
    </>
  );
}

/** `HomeFooter` UI 컴포넌트를 렌더링함 */
export function HomeFooter({ locale }: { readonly locale: Locale }) {
  const text = getHomeMessages(locale).shell;
  return (
    <footer className="mx-auto w-full max-w-[1600px] overflow-hidden bg-foreground px-[clamp(20px,4vw,64px)] pt-[clamp(72px,9vw,130px)] pb-7 text-background">
      <div>
        <p className="mb-4 font-mono text-[11px] tracking-[0.07em] text-background/72 uppercase">
          {text.footerQuestion}
        </p>
        <a
          className="border-b-2 border-accent text-[clamp(23px,3vw,44px)] font-semibold tracking-[-0.04em]"
          href="https://github.com/jongminchung"
          target="_blank"
          rel="noreferrer"
        >
          {text.footerAction} <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p
        className="mt-[clamp(70px,10vw,150px)] text-[clamp(90px,20vw,320px)] leading-[0.72] tracking-[-0.095em] whitespace-nowrap text-transparent [-webkit-text-stroke:2px_color-mix(in_oklch,var(--background)_26%,transparent)] max-[720px]:mt-20 max-[720px]:text-[25vw]"
        aria-hidden="true"
      >
        JAMIE.KR
      </p>
      <div className="flex justify-between gap-[18px] border-t border-background/24 pt-[26px] font-mono text-[9px] tracking-[0.08em] text-background/72 uppercase max-[720px]:flex-col max-[720px]:items-start">
        <span>Jongmin Chung</span>
        <span>{text.disciplines}</span>
        <span>© 2026</span>
      </div>
    </footer>
  );
}

/** `PersonStructuredData` UI 컴포넌트를 렌더링함 */
export function PersonStructuredData({ locale }: { readonly locale: Locale }) {
  return <StructuredData value={createHomeProfileStructuredData(locale)} />;
}
