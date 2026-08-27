import type { Locale } from "#lib/content-model";
import { AnimationShowcase } from "./AnimationShowcase";

const copy = {
  ko: {
    eyebrow: "ANIMATION SYSTEMS",
    title: "Showcase",
    description:
      "같은 시스템 흐름을 조작 가능한 타임라인과 렌더링 중심 장면으로 표현합니다",
    note: "두 데모는 현재 페이지에 맞춘 경량 SVG 프로토타입이며 각 도구의 제작 모델과 경계를 보여줍니다",
  },
  en: {
    eyebrow: "ANIMATION SYSTEMS",
    title: "Showcase",
    description:
      "One system flow, expressed as an interactive timeline and a rendered explanatory scene",
    note: "Both demos are lightweight SVG prototypes for this page, showing each tool's authoring model and boundary",
  },
} as const;

/** 애니메이션 제작 모델 쇼케이스를 렌더링함 */
export function ShowcasePage({
  locale,
}: {
  readonly locale: Locale;
}): React.JSX.Element {
  const text = copy[locale];
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 pt-[clamp(64px,9vw,112px)] pb-24 max-[680px]:px-4 max-[680px]:pt-12">
      <header className="mb-12 max-w-[760px]">
        <p className="m-0 font-mono text-[11px] font-medium tracking-[.12em] text-primary uppercase">
          {text.eyebrow}
        </p>
        <h1 className="mt-4 mb-4 text-[clamp(42px,7vw,76px)] leading-[.95] font-medium tracking-[-.055em]">
          {text.title}
        </h1>
        <p className="m-0 max-w-[680px] text-[clamp(16px,2vw,20px)] leading-[1.55] text-muted-foreground">
          {text.description}
        </p>
      </header>

      <AnimationShowcase locale={locale} />

      <p className="mt-8 max-w-[760px] border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">
        {text.note}
      </p>
    </main>
  );
}
