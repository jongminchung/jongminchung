import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { getLocalizedDocuments } from "#lib/documents";
import { getHomeContent } from "#lib/home/content";
import { getInvestmentNotes } from "#lib/invest/notes";
import type { Locale } from "#lib/site-routing";

/** `HeroSection` UI 컴포넌트를 렌더링함 */
export function HeroSection({ locale }: { readonly locale: Locale }) {
  const { hero } = getHomeContent(locale);
  return (
    <section
      className="mx-auto grid min-h-[calc(100dvh-58px)] w-full max-w-[1600px] px-[clamp(20px,4vw,64px)] pt-[clamp(64px,11vw,148px)] pb-[clamp(64px,9vw,110px)] max-[720px]:min-h-0 max-[720px]:pt-16"
      id="top"
      aria-labelledby="hero-title"
    >
      <div className="mx-auto w-full max-w-190 self-center text-center">
        <h1
          className="m-0 max-w-190 text-[clamp(36px,5vw,58px)] leading-[1.08] font-semibold tracking-[-0.045em] max-[720px]:text-[clamp(49px,14vw,68px)] max-[720px]:leading-[.86]"
          id="hero-title"
        >
          {locale === "ko" ? "무엇을 함께 만들까요?" : "Where should we begin?"}
        </h1>
        <p className="mx-auto mt-4.5 max-w-147.5 text-[clamp(16px,1.5vw,18px)] leading-[1.55] text-muted-foreground max-[720px]:mt-7 max-[720px]:text-lg">
          {locale === "ko"
            ? "프로젝트, 기술 문서와 리서치 노트를 한곳에서 탐색할 수 있음"
            : "Explore projects, engineering notes, and research in one place."}
        </p>
        <div
          className="mt-8.5 flex min-h-13.5 items-center gap-3 rounded-3xl border bg-card py-2 pr-2.5 pl-4.5 text-left text-muted-foreground shadow-(--elevation-low)"
          aria-hidden="true"
        >
          <span className="flex-1 text-[15px]">
            {locale === "ko" ? "무엇이든 물어보세요" : "Ask anything"}
          </span>
          <b className="grid size-8.5 place-items-center rounded-full bg-foreground text-base text-background">
            ↑
          </b>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-5.5">
          <a
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "border-foreground bg-foreground font-mono text-xs text-background transition-[background,color,transform] hover:-translate-x-0.75 hover:-translate-y-0.75 hover:bg-accent hover:text-accent-foreground",
              "min-h-[50px] gap-[26px] px-[18px]",
            )}
            href="#work"
          >
            {hero.workAction} <span aria-hidden="true">↓</span>
          </a>
          <a
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "border-x-0 border-t-0 border-b border-foreground bg-transparent font-mono text-xs leading-[1.8] text-foreground hover:bg-muted hover:text-foreground",
              "h-9 px-4",
            )}
            href={`https://tech.jamie.kr/${locale}`}
          >
            {hero.techAction} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            className="inline-flex min-h-[34px] items-center rounded-full border bg-card px-[11px] py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href="#work"
          >
            {locale === "ko" ? "프로젝트 보기" : "View projects"}
          </a>
          <a
            className="inline-flex min-h-[34px] items-center rounded-full border bg-card px-[11px] py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href="#writing"
          >
            {locale === "ko" ? "최근 글 읽기" : "Read recent notes"}
          </a>
        </div>
      </div>
    </section>
  );
}

/** `WorkSection` UI 컴포넌트를 렌더링함 */
export function WorkSection({ locale }: { readonly locale: Locale }) {
  const { projects } = getHomeContent(locale);
  return (
    <section
      className="mx-auto w-full max-w-[1600px] border-t bg-card px-[clamp(20px,4vw,64px)] py-[clamp(78px,10vw,150px)]"
      id="work"
      aria-labelledby="work-title"
    >
      <div className="mb-15 grid grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)] items-end gap-15 max-[720px]:mb-9.5 max-[720px]:grid-cols-1 max-[720px]:gap-7">
        <div>
          <p className="mb-5.5 font-mono text-[11px] font-semibold tracking-[.11em] text-primary">
            SELECTED WORK / 2026
          </p>
          <h2
            className="m-0 max-w-212.5 text-[clamp(42px,6.4vw,96px)] leading-[.9] tracking-[-.07em]"
            id="work-title"
          >
            {locale === "ko"
              ? "읽고 이해할 수 있게 만든 것"
              : "Things built to be read."}
          </h2>
        </div>
      </div>
      <div className="border-t border-foreground">
        {projects.map((project) => (
          <a
            className="grid grid-cols-[minmax(250px,.9fr)_minmax(300px,1.1fr)_minmax(250px,.8fr)] items-center gap-[clamp(24px,4vw,70px)] border-b py-[38px] transition-[padding,background] hover:bg-background/70 hover:px-[18px] max-[980px]:grid-cols-[minmax(220px,.8fr)_minmax(0,1.2fr)] max-[720px]:grid-cols-1 max-[720px]:gap-[22px] max-[720px]:py-[30px] max-[720px]:hover:px-2.5"
            data-project="true"
            href={project.href}
            key={project.index}
          >
            <div className="grid grid-cols-[42px_1fr] items-baseline">
              <span className="font-mono text-[10px] tracking-[.08em] text-primary uppercase">
                {project.index}
              </span>
              <span className="font-mono text-[10px] tracking-[.08em] text-muted-foreground uppercase">
                {project.category}
              </span>
              <h3 className="col-start-2 mt-2 mb-0 text-[clamp(25px,2.7vw,42px)] leading-none tracking-[-.055em] break-words">
                {project.title}
              </h3>
            </div>
            <p className="m-0 text-[15px] leading-[1.65] text-muted-foreground">
              {project.description}
            </p>
            <div className="flex items-center justify-between gap-5 max-[980px]:col-start-2 max-[720px]:col-auto">
              <ul
                className="m-0 flex list-none flex-wrap gap-2 p-0"
                aria-label={`${project.title} technologies`}
              >
                {project.tags.map((tag) => (
                  <li
                    className="border px-2 py-1.5 font-mono text-[9px] tracking-[.04em]"
                    key={tag}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <span
                className="grid size-11 shrink-0 place-items-center border border-foreground text-xl transition-transform group-hover:rotate-[8deg]"
                aria-hidden="true"
              >
                ↗
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/** `WritingSection` UI 컴포넌트를 렌더링함 */
export async function WritingSection({ locale }: { readonly locale: Locale }) {
  const tech = (await getLocalizedDocuments(locale))
    .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);
  const invest = (await getInvestmentNotes(locale)).slice(0, 3);
  return (
    <section
      className="mx-auto w-full max-w-[1600px] border-t px-[clamp(20px,4vw,64px)] py-[clamp(78px,10vw,150px)]"
      id="writing"
      aria-labelledby="writing-title"
    >
      <div className="mb-15 grid grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)] items-end gap-15 max-[720px]:mb-9.5 max-[720px]:grid-cols-1 max-[720px]:gap-7">
        <div>
          <p className="mb-5.5 font-mono text-[11px] font-semibold tracking-[.11em] text-primary">
            LATEST WRITING
          </p>
          <h2
            className="m-0 max-w-212.5 text-[clamp(42px,6.4vw,96px)] leading-[.9] tracking-[-.07em]"
            id="writing-title"
          >
            {locale === "ko" ? "최근 기록" : "Recent notes."}
          </h2>
        </div>
        <p className="m-0 text-[17px] leading-[1.7] text-muted-foreground">
          {locale === "ko"
            ? "지금 읽을 수 있는 기술과 투자 기록을 모음"
            : "The latest engineering and investment notes, ready to read."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-[clamp(36px,7vw,110px)] max-[720px]:grid-cols-1">
        <div className="[&_a]:grid [&_a]:grid-cols-[104px_1fr_auto] [&_a]:items-baseline [&_a]:gap-[18px] [&_a]:border-b [&_a]:py-[22px] max-[720px]:[&_a]:grid-cols-[86px_1fr_auto] [&_a_span:first-child]:font-mono [&_a_span:first-child]:text-[11px] [&_a_span:first-child]:text-muted-foreground [&_a_strong]:text-lg [&_h3]:m-0 [&_h3]:border-b [&_h3]:border-foreground [&_h3]:pb-[18px] [&_h3]:font-mono [&_h3]:text-xs [&_h3]:tracking-[.08em] [&_h3]:uppercase">
          <h3>Engineering Notes</h3>
          {tech.map((article) => (
            <a key={article.id} href={`https://tech.jamie.kr${article.href}`}>
              <span>{article.publishedAt}</span>
              <strong>{article.title}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
        <div className="[&_a]:grid [&_a]:grid-cols-[104px_1fr_auto] [&_a]:items-baseline [&_a]:gap-[18px] [&_a]:border-b [&_a]:py-[22px] max-[720px]:[&_a]:grid-cols-[86px_1fr_auto] [&_a_span:first-child]:font-mono [&_a_span:first-child]:text-[11px] [&_a_span:first-child]:text-muted-foreground [&_a_strong]:text-lg [&_h3]:m-0 [&_h3]:border-b [&_h3]:border-foreground [&_h3]:pb-4.5 [&_h3]:font-mono [&_h3]:text-xs [&_h3]:tracking-[.08em] [&_h3]:uppercase">
          <h3>Investment Notes</h3>
          {invest.length === 0 ? (
            <p className="m-0 border-b py-7.5 font-mono text-[11px] text-muted-foreground">
              {locale === "ko"
                ? "첫 리서치 노트를 준비 중임"
                : "The first research note is in preparation."}
            </p>
          ) : (
            invest.map((note) => (
              <a key={note.id} href={`https://invest.jamie.kr${note.href}`}>
                <span>{note.publishedAt}</span>
                <strong>{note.title}</strong>
                <span aria-hidden="true">↗</span>
              </a>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/** `PrinciplesSection` UI 컴포넌트를 렌더링함 */
export function PrinciplesSection({ locale }: { readonly locale: Locale }) {
  const { principles } = getHomeContent(locale);
  return (
    <section
      className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,.9fr)_minmax(360px,1.1fr)] gap-[clamp(54px,9vw,150px)] bg-primary px-[clamp(20px,4vw,64px)] py-[clamp(82px,11vw,170px)] text-primary-foreground max-[980px]:grid-cols-1"
      id="principles"
      aria-labelledby="principles-title"
    >
      <div>
        <p className="mb-5.5 font-mono text-[11px] font-semibold tracking-[.11em] text-primary-foreground">
          README / HOW I WORK
        </p>
        <h2
          className="m-0 max-w-212.5 text-[clamp(42px,6.4vw,96px)] leading-[.9] tracking-[-.07em]"
          id="principles-title"
        >
          {locale === "ko" ? "일하는 원칙" : "Working principles."}
        </h2>
        <p className="mt-8.5 mb-0 max-w-145 text-[17px] leading-[1.7] text-primary-foreground">
          {locale === "ko"
            ? "언어를 맞추고 경계를 분명히 하며, 변경을 검증함"
            : "Align language, clarify boundaries, and verify change."}
        </p>
      </div>
      <ol className="m-0 list-none border-t border-primary-foreground/54 p-0">
        {principles.map((principle, index) => (
          <li
            className="grid grid-cols-[54px_1fr] gap-4.5 border-b border-primary-foreground/32 py-7.5"
            key={principle.key}
          >
            <span className="font-mono text-[11px] text-primary-foreground">
              0{index + 1}
            </span>
            <div>
              <h3 className="mt-0 mb-2 text-[clamp(22px,2.2vw,32px)] tracking-[-.03em]">
                {principle.title}
              </h3>
              <p className="m-0 text-[15px] leading-[1.6]">{principle.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
