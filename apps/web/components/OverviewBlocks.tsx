import { buttonVariants } from "@jongminchung/ui/components/button";
import { Card } from "@jongminchung/ui/components/card";
import { cn } from "@jongminchung/ui/lib/utils";
import Link from "next/link";
import type { Locale } from "#lib/content-model";
import { Icon } from "./Icon";

const copy = {
    ko: {
        eyebrow: "ENGINEERING NOTES",
        title: "문제를 이해하고, 모델을 만들고, 동작하는 코드로 연결하세요.",
        lead: "협업 원칙부터 플랫폼의 동작 원리와 실패 사례까지 두 개의 시리즈에서 필요한 깊이로 이동할 수 있습니다.",
        start: "핸드북부터 시작",
        deepDive: "Deep Dive 보기",
        steps: [
            [
                "1",
                "원칙을 맞춥니다",
                "협업과 도메인 설계의 기준을 먼저 공유합니다.",
            ],
            [
                "2",
                "경계를 설명합니다",
                "설계 선택과 공개 계약이 만들어지는 이유를 글로 남깁니다.",
            ],
            [
                "3",
                "기반까지 추적합니다",
                "버전별 선택과 실패 원인을 Deep Dive에서 검증합니다.",
            ],
        ],
        cards: [
            [
                "Handbook",
                "협업과 DDD",
                "문제와 변경을 설명하는 공통 언어를 만듭니다.",
                "/ko/series/handbook",
            ],
            [
                "Articles",
                "독립적으로 읽는 기술 글",
                "구현과 분석을 하나의 완결된 글로 읽습니다.",
                "/ko/articles/react-component-based-thinking",
            ],
            [
                "Deep Dive",
                "도구를 선택한 이유",
                "Next.js, pnpm, Node.js와 TypeScript를 깊이 다룹니다.",
                "/ko/series/deep-dive",
            ],
            [
                "Bilingual",
                "같은 문서, 같은 ID",
                "한국어와 영어 사이를 문맥을 잃지 않고 전환합니다.",
                "/en",
            ],
        ],
        open: "문서 열기",
        ctaTitle: "문서도 공개 API처럼 검증합니다.",
        ctaBody:
            "언어 쌍, 링크, 시리즈 순서와 검색 데이터를 빌드마다 함께 검사합니다.",
        edit: "GitHub에서 함께 다듬기",
    },
    en: {
        eyebrow: "ENGINEERING NOTES",
        title: "Understand the problem, shape the model, and connect it to working code.",
        lead: "Move from collaboration principles to platform behavior and failure cases through two focused series.",
        start: "Start with the handbook",
        deepDive: "Browse Deep Dives",
        steps: [
            [
                "1",
                "Align the principles",
                "Share the collaboration and domain-design baseline first.",
            ],
            [
                "2",
                "Explain the boundary",
                "Record why a design choice or public contract exists.",
            ],
            [
                "3",
                "Trace the foundation",
                "Verify version choices and failures in the Deep Dives.",
            ],
        ],
        cards: [
            [
                "Handbook",
                "Collaboration and DDD",
                "Create a shared language for problems and change.",
                "/en/series/handbook",
            ],
            [
                "Articles",
                "Standalone engineering writing",
                "Read implementation and analysis as complete articles.",
                "/en/articles/react-component-based-thinking",
            ],
            [
                "Deep Dive",
                "Why each tool is here",
                "Explore Next.js, pnpm, Node.js, and TypeScript.",
                "/en/series/deep-dive",
            ],
            [
                "Bilingual",
                "Same document, same ID",
                "Switch between English and Korean without losing context.",
                "/ko",
            ],
        ],
        open: "Open docs",
        ctaTitle: "Documentation is verified like a public API.",
        ctaBody:
            "Locale pairs, links, series order, and search data are checked together on every build.",
        edit: "Improve it on GitHub",
    },
} as const;

/** `OverviewHero` UI 컴포넌트를 렌더링함 */
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
                <p className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {text.eyebrow}
                </p>
                <h1 className="mt-[18px] mb-4 font-sans text-[40px] leading-[1.08] font-medium tracking-[-0.03em] text-primary max-[760px]:text-[36px]">
                    {text.title}
                </h1>
                <p className="m-0 max-w-[620px] text-base leading-[1.55] text-muted-foreground">
                    {text.lead}
                </p>
                <div className="mt-8 flex flex-wrap gap-2.5">
                    <Link
                        className={cn(
                            buttonVariants({ variant: "default", size: "lg" }),
                            "h-11 px-5",
                        )}
                        href={`/${locale}/series/handbook`}
                    >
                        {text.start}
                    </Link>
                    <Link
                        className={cn(
                            buttonVariants({ variant: "outline", size: "lg" }),
                            "h-11 px-5",
                        )}
                        href={`/${locale}/series/deep-dive`}
                    >
                        {text.deepDive}
                    </Link>
                </div>
            </div>
        </header>
    );
}

/** `QuickStart` UI 컴포넌트를 렌더링함 */
export function QuickStart({ locale }: { readonly locale: Locale }) {
    return (
        <div className="grid grid-cols-3 gap-5 max-[760px]:grid-cols-1">
            {copy[locale].steps.map(([number, title, description]) => (
                <Card
                    key={number}
                    className="rounded-lg border border-border p-6"
                >
                    <span className="grid size-7 place-items-center rounded-full border border-input font-mono text-xs text-primary">
                        {number}
                    </span>
                    <h3 className="mt-[18px] mb-2 font-sans text-xl leading-[1.25] font-medium text-primary">
                        {title}
                    </h3>
                    <p className="m-0 text-[14px] leading-[1.4rem] text-muted-foreground">
                        {description}
                    </p>
                </Card>
            ))}
        </div>
    );
}

/** `OverviewCards` UI 컴포넌트를 렌더링함 */
export function OverviewCards({ locale }: { readonly locale: Locale }) {
    const text = copy[locale];
    return (
        <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
            {text.cards.map(([category, title, description, href]) => (
                <Card
                    key={category}
                    className="flex min-h-[208px] flex-col rounded-lg border border-border p-6"
                >
                    <p className="m-0 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                        {category}
                    </p>
                    <h3 className="mt-4 mb-2 font-sans text-xl leading-[1.25] font-medium text-primary">
                        {title}
                    </h3>
                    <p className="m-0 text-[14px] leading-[1.4rem] text-muted-foreground">
                        {description}
                    </p>
                    <Link
                        aria-label={`${text.open}: ${title}`}
                        className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "mt-auto h-8 self-start px-3 text-xs",
                        )}
                        href={href}
                    >
                        {text.open}
                        <Icon icon="chevronRight" className="size-3.5" />
                    </Link>
                </Card>
            ))}
        </div>
    );
}

/** `OverviewCta` UI 컴포넌트를 렌더링함 */
export function OverviewCta({ locale }: { readonly locale: Locale }) {
    const text = copy[locale];
    return (
        <Card className="flex items-center justify-between gap-8 rounded-lg border border-border p-8 max-[760px]:items-start max-[760px]:flex-col">
            <div>
                <h3 className="m-0 font-sans text-2xl leading-[1.25] font-medium text-primary">
                    {text.ctaTitle}
                </h3>
                <p className="mt-2 mb-0 max-w-[640px] text-[14px] leading-[1.4rem] text-muted-foreground">
                    {text.ctaBody}
                </p>
            </div>
            <a
                className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "h-11 px-5",
                )}
                href="https://github.com/jongminchung/jongminchung"
                rel="noreferrer"
                target="_blank"
            >
                {text.edit}
            </a>
        </Card>
    );
}
