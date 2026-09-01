import { buttonVariants } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { getHomeContent, getHomeMessages } from "#lib/home/content";
import { siteOrigins, type Locale } from "#lib/site-routing";

/** `HeroSection` UI 컴포넌트를 렌더링함 */
export function HeroSection({ locale }: { readonly locale: Locale }) {
  const { hero } = getHomeContent(locale);
  const text = getHomeMessages(locale).hero;
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
          {text.title}
        </h1>
        <p className="mx-auto mt-4.5 max-w-147.5 text-[clamp(16px,1.5vw,18px)] leading-[1.55] text-muted-foreground max-[720px]:mt-7 max-[720px]:text-lg">
          {text.description}
        </p>
        <div
          className="mt-8.5 flex min-h-13.5 items-center gap-3 rounded-3xl border bg-card py-2 pr-2.5 pl-4.5 text-left text-muted-foreground shadow-(--elevation-low)"
          aria-hidden="true"
        >
          <span className="flex-1 text-[15px]">{text.prompt}</span>
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
            href={`${siteOrigins.tech}/${locale}`}
          >
            {hero.techAction} <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            className="inline-flex min-h-[34px] items-center rounded-full border bg-card px-[11px] py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href="#work"
          >
            {text.viewProjects}
          </a>
          <a
            className="inline-flex min-h-[34px] items-center rounded-full border bg-card px-[11px] py-[7px] text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href="#writing"
          >
            {text.readNotes}
          </a>
        </div>
      </div>
    </section>
  );
}
