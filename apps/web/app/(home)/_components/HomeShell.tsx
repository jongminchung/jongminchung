import { BrandWordmark } from "#components/BrandWordmark";
import { ThemeControl } from "#components/ThemeControl";
import { personSchema } from "#lib/home/content";
import type { Locale } from "#lib/site-routing";

/** `HomeHeader` UI 컴포넌트를 렌더링함 */
export function HomeHeader({ locale }: { readonly locale: Locale }) {
  return (
    <>
      <a
        className="fixed top-3 left-3 z-[100] -translate-y-[160%] bg-foreground px-3.5 py-2.5 font-mono text-xs text-background transition-transform focus:translate-y-0"
        href="#main-content"
      >
        {locale === "ko" ? "본문으로 건너뛰기" : "Skip to content"}
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
          className="flex items-center gap-[clamp(10px,1.8vw,22px)] text-[13px] [&_a]:relative [&_a]:after:absolute [&_a]:after:right-0 [&_a]:after:-bottom-2 [&_a]:after:left-0 [&_a]:after:h-0.5 [&_a]:after:origin-left [&_a]:after:scale-x-0 [&_a]:after:bg-primary [&_a]:after:transition-transform [&_a:hover]:after:scale-x-100 max-[720px]:gap-[15px] max-[720px]:[&_a:nth-child(-n+2)]:hidden"
          aria-label="Primary navigation"
        >
          <a href="#work">{locale === "ko" ? "프로젝트" : "Work"}</a>
          <a href="#writing">{locale === "ko" ? "글" : "Writing"}</a>
          <a href="#principles">{locale === "ko" ? "원칙" : "Principles"}</a>
          <a
            href={`/${locale === "ko" ? "en" : "ko"}`}
            hrefLang={locale === "ko" ? "en" : "ko"}
          >
            {locale === "ko" ? "EN" : "KO"}
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
  return (
    <footer className="mx-auto w-full max-w-[1600px] overflow-hidden bg-foreground px-[clamp(20px,4vw,64px)] pt-[clamp(72px,9vw,130px)] pb-7 text-background">
      <div>
        <p className="mb-4 font-mono text-[11px] tracking-[0.07em] text-background/72 uppercase">
          {locale === "ko"
            ? "더 명확한 언어가 필요한 시스템이 있나요?"
            : "Have a system that needs clearer words?"}
        </p>
        <a
          className="border-b-2 border-accent text-[clamp(23px,3vw,44px)] font-semibold tracking-[-0.04em]"
          href="https://github.com/jongminchung"
          target="_blank"
          rel="noreferrer"
        >
          {locale === "ko"
            ? "저장소에서 시작하기"
            : "Start with the repository"}{" "}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p
        className="mt-[clamp(70px,10vw,150px)] whitespace-nowrap text-[clamp(90px,20vw,320px)] leading-[0.72] tracking-[-0.095em] text-transparent [-webkit-text-stroke:2px_color-mix(in_oklch,var(--background)_26%,transparent)] max-[720px]:mt-20 max-[720px]:text-[25vw]"
        aria-hidden="true"
      >
        JAMIE.KR
      </p>
      <div className="flex justify-between gap-[18px] border-t border-background/24 pt-[26px] font-mono text-[9px] tracking-[0.08em] text-background/72 uppercase max-[720px]:flex-col max-[720px]:items-start">
        <span>Jongmin Chung</span>
        <span>
          {locale === "ko" ? "언어 · 모델 · 코드" : "Language · Models · Code"}
        </span>
        <span>© 2026</span>
      </div>
    </footer>
  );
}

/** `PersonStructuredData` UI 컴포넌트를 렌더링함 */
export function PersonStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(personSchema).replaceAll("<", "\\u003c"),
      }}
    />
  );
}
