import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/content-model";
import { Icon } from "./Icon";
import { TransitionLink } from "./RouteTransition";

const copy = {
  ko: {
    eyebrow: "공식 문서",
    title: "문제를 이해하고, 모델을 만들고, 동작하는 코드로 연결하세요.",
    lead: "협업 원칙에서 패키지 API와 기반 기술의 실패 사례까지 필요한 깊이로 바로 이동할 수 있습니다.",
    start: "핸드북부터 시작",
    packages: "패키지 API 보기",
    steps: [
      ["1", "원칙을 맞춥니다", "협업과 도메인 설계의 기준을 먼저 공유합니다."],
      ["2", "공개 계약을 찾습니다", "설치, 사용법, 실제 export를 한 페이지에서 확인합니다."],
      ["3", "기반까지 추적합니다", "버전별 선택과 실패 원인을 Deep Dive에서 검증합니다."],
    ],
    cards: [
      [
        "Handbook",
        "협업과 DDD",
        "문제와 변경을 설명하는 공통 언어를 만듭니다.",
        "/ko/handbook/collaboration",
      ],
      [
        "Packages",
        "실제로 배포되는 API",
        "두 패키지의 설치, 예제, 공개 symbol을 확인합니다.",
        "/ko/packages/remark-plantuml",
      ],
      [
        "Deep Dive",
        "도구를 선택한 이유",
        "Next.js, pnpm, Node.js와 TypeScript를 깊이 다룹니다.",
        "/ko/deep-dive/nextjs-16",
      ],
      [
        "Bilingual",
        "같은 문서, 같은 ID",
        "한국어와 영어 사이를 문맥을 잃지 않고 전환합니다.",
        "/en/overview",
      ],
    ],
    open: "문서 열기",
    ctaTitle: "문서도 공개 API처럼 검증합니다.",
    ctaBody: "언어 쌍, 링크, 순서, 검색 데이터와 package export를 빌드마다 함께 검사합니다.",
    edit: "GitHub에서 함께 다듬기",
  },
  en: {
    eyebrow: "Official documentation",
    title: "Understand the problem, shape the model, and connect it to working code.",
    lead: "Move directly to the depth you need, from collaboration principles to package APIs and platform failure cases.",
    start: "Start with the handbook",
    packages: "Browse package APIs",
    steps: [
      ["1", "Align the principles", "Share the collaboration and domain-design baseline first."],
      ["2", "Find the public contract", "See installation, usage, and real exports on one page."],
      ["3", "Trace the foundation", "Verify version choices and failures in the Deep Dives."],
    ],
    cards: [
      [
        "Handbook",
        "Collaboration and DDD",
        "Create a shared language for problems and change.",
        "/en/handbook/collaboration",
      ],
      [
        "Packages",
        "APIs that actually ship",
        "Inspect installation, examples, and public symbols for two packages.",
        "/en/packages/remark-plantuml",
      ],
      [
        "Deep Dive",
        "Why each tool is here",
        "Explore Next.js, pnpm, Node.js, and TypeScript.",
        "/en/deep-dive/nextjs-16",
      ],
      [
        "Bilingual",
        "Same document, same ID",
        "Switch between English and Korean without losing context.",
        "/ko/overview",
      ],
    ],
    open: "Open docs",
    ctaTitle: "Documentation is verified like a public API.",
    ctaBody:
      "Locale pairs, links, order, search data, and package exports are checked together on every build.",
    edit: "Improve it on GitHub",
  },
} as const;

export function OverviewHero({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  return (
    <header
      className="relative overflow-hidden rounded-lg border border-border bg-card px-10 py-20 max-[760px]:px-6 max-[760px]:py-12"
      data-overview-hero="true"
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34%] border-l border-border bg-background lg:block"
        aria-hidden="true"
      >
        <span className="absolute inset-y-0 left-1/3 border-l border-border" />
        <span className="absolute inset-y-0 left-2/3 border-l border-border" />
      </div>
      <div className="relative z-[1] max-w-[720px]">
        <p className="m-0 font-[family-name:var(--font-dm-mono)] text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {text.eyebrow}
        </p>
        <h1 className="mt-[18px] mb-4 font-[family-name:var(--font-inter-tight)] text-[40px] leading-[1.08] font-medium tracking-[-0.03em] text-primary max-[760px]:text-[36px]">
          {text.title}
        </h1>
        <p className="m-0 max-w-[620px] text-base leading-[1.55] text-muted-foreground">
          {text.lead}
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          <Button asChild size="lg">
            <TransitionLink href={`/${locale}/handbook/collaboration`}>{text.start}</TransitionLink>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <TransitionLink href={`/${locale}/packages/remark-plantuml`}>
              {text.packages}
            </TransitionLink>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function QuickStart({ locale }: { readonly locale: Locale }) {
  return (
    <div className="grid grid-cols-3 gap-5 max-[760px]:grid-cols-1">
      {copy[locale].steps.map(([number, title, description]) => (
        <Card key={number} className="p-6">
          <span className="grid size-7 place-items-center rounded-full border border-input font-[family-name:var(--font-dm-mono)] text-xs text-primary">
            {number}
          </span>
          <h3 className="mt-[18px] mb-2 font-[family-name:var(--font-inter-tight)] text-xl leading-[1.25] font-medium text-primary">
            {title}
          </h3>
          <p className="m-0 text-[14px] leading-[1.4rem] text-muted-foreground">{description}</p>
        </Card>
      ))}
    </div>
  );
}

export function OverviewCards({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  return (
    <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
      {text.cards.map(([category, title, description, href]) => (
        <Card key={category} className="flex min-h-[208px] flex-col p-6">
          <p className="m-0 font-[family-name:var(--font-dm-mono)] text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {category}
          </p>
          <h3 className="mt-4 mb-2 font-[family-name:var(--font-inter-tight)] text-xl leading-[1.25] font-medium text-primary">
            {title}
          </h3>
          <p className="m-0 text-[14px] leading-[1.4rem] text-muted-foreground">{description}</p>
          <Button asChild variant="ghost" size="sm" className="mt-auto self-start">
            <TransitionLink href={href} aria-label={`${text.open}: ${title}`}>
              {text.open}
              <Icon icon="chevronRight" className="size-3.5" />
            </TransitionLink>
          </Button>
        </Card>
      ))}
    </div>
  );
}

export function OverviewCta({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  return (
    <Card className="flex items-center justify-between gap-8 p-8 max-[760px]:items-start max-[760px]:flex-col">
      <div>
        <h3 className="m-0 font-[family-name:var(--font-inter-tight)] text-2xl leading-[1.25] font-medium text-primary">
          {text.ctaTitle}
        </h3>
        <p className="mt-2 mb-0 max-w-[640px] text-[14px] leading-[1.4rem] text-muted-foreground">
          {text.ctaBody}
        </p>
      </div>
      <Button asChild size="lg">
        <a href="https://github.com/jongminchung/jongminchung" target="_blank" rel="noreferrer">
          {text.edit}
        </a>
      </Button>
    </Card>
  );
}
