import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import type { Locale } from "@/lib/content-model";
import styles from "./OverviewBlocks.module.css";

const copy = {
  ko: {
    eyebrow: "OFFICIAL DOCUMENTATION",
    title: "생각을 모델로, 모델을 움직이는 코드로.",
    lead: "Jongmin Chung Docs는 협업 원칙에서 패키지 API, 기반 기술의 실패 사례까지 한 경로로 연결합니다.",
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
        "세 패키지의 설치, 예제, 공개 symbol을 확인합니다.",
        "/ko/packages/remark-plantuml",
      ],
      [
        "Deep Dive",
        "도구를 선택한 이유",
        "Next.js, pnpm, Node.js, TypeScript, Astryx를 깊이 다룹니다.",
        "/ko/deep-dive/nextjs-16",
      ],
      [
        "Bilingual",
        "같은 문서, 같은 ID",
        "한국어와 영어 사이를 문맥을 잃지 않고 전환합니다.",
        "/en/overview",
      ],
    ],
    ctaTitle: "문서도 공개 API처럼 검증합니다.",
    ctaBody: "언어 쌍, 링크, 순서, 검색 데이터와 package export가 빌드마다 함께 검사됩니다.",
    edit: "GitHub에서 함께 다듬기",
  },
  en: {
    eyebrow: "OFFICIAL DOCUMENTATION",
    title: "From a shared idea to a model—and code that moves it.",
    lead: "Jongmin Chung Docs connects collaboration principles, package APIs, and platform failure cases through one path.",
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
        "Inspect installation, examples, and public symbols for three packages.",
        "/en/packages/remark-plantuml",
      ],
      [
        "Deep Dive",
        "Why each tool is here",
        "Explore Next.js, pnpm, Node.js, TypeScript, and Astryx.",
        "/en/deep-dive/nextjs-16",
      ],
      [
        "Bilingual",
        "Same document, same ID",
        "Switch between English and Korean without losing context.",
        "/ko/overview",
      ],
    ],
    ctaTitle: "Documentation is verified like a public API.",
    ctaBody:
      "Locale pairs, links, order, search data, and package exports are checked together on every build.",
    edit: "Improve it on GitHub",
  },
} as const;

export function OverviewHero({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  return (
    <header className={styles.hero}>
      <div className={styles.heroGrid} aria-hidden="true" />
      <p className={styles.eyebrow}>{text.eyebrow}</p>
      <h1>{text.title}</h1>
      <p className={styles.lead}>{text.lead}</p>
      <div className={styles.actions}>
        <Button
          label={text.start}
          href={`/${locale}/handbook/collaboration`}
          variant="primary"
          size="lg"
        />
        <Button
          label={text.packages}
          href={`/${locale}/packages/remark-plantuml`}
          variant="secondary"
          size="lg"
        />
      </div>
    </header>
  );
}

export function QuickStart({ locale }: { readonly locale: Locale }) {
  return (
    <div className={styles.stepGrid}>
      {copy[locale].steps.map(([number, title, description]) => (
        <Card key={number} padding={5} className={styles.stepCard}>
          <span className={styles.stepNumber}>{number}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </Card>
      ))}
    </div>
  );
}

export function KnowledgePath({ locale }: { readonly locale: Locale }) {
  const labels =
    locale === "ko"
      ? ["문제", "핸드북", "패키지", "실행 환경"]
      : ["Problem", "Handbook", "Packages", "Runtime"];
  return (
    <figure className={styles.pathFigure}>
      <svg viewBox="0 0 920 280" role="img" aria-labelledby="knowledge-path-title">
        <title id="knowledge-path-title">
          {locale === "ko"
            ? "J 지식 경로와 패키지 관계"
            : "J knowledge path and package relationships"}
        </title>
        <defs>
          <linearGradient id="j-path-gradient" x1="0" x2="1">
            <stop offset="0" stopColor="#ff2d8d" />
            <stop offset="0.52" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#2787ff" />
          </linearGradient>
        </defs>
        <path
          className={styles.pathLine}
          d="M125 45h160v112c0 51 41 92 92 92h418"
          fill="none"
          stroke="url(#j-path-gradient)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        {[125, 335, 565, 795].map((x, index) => (
          <g key={x}>
            <circle
              cx={x}
              cy={index === 0 ? 45 : 249}
              r="26"
              fill="var(--color-background-card)"
              stroke="url(#j-path-gradient)"
              strokeWidth="5"
            />
            <text
              x={x}
              y={index === 0 ? 101 : 211}
              textAnchor="middle"
              className={styles.pathLabel}
            >
              {labels[index]}
            </text>
          </g>
        ))}
        <text x="450" y="132" textAnchor="middle" className={styles.packageLabel}>
          remark-plantuml
        </text>
        <text x="590" y="174" textAnchor="middle" className={styles.packageLabel}>
          tooling
        </text>
        <text x="696" y="211" textAnchor="middle" className={styles.packageLabel}>
          ui → Astryx
        </text>
      </svg>
    </figure>
  );
}

export function OverviewCards({ locale }: { readonly locale: Locale }) {
  return (
    <div className={styles.cardGrid}>
      {copy[locale].cards.map(([category, title, description, href]) => (
        <Card key={category} padding={6} className={styles.overviewCard}>
          <p className={styles.cardCategory}>{category}</p>
          <h3>{title}</h3>
          <p>{description}</p>
          <Button label={title} href={href} variant="ghost" size="sm">
            {locale === "ko" ? "문서 열기 →" : "Open docs →"}
          </Button>
        </Card>
      ))}
    </div>
  );
}

export function OverviewCta({ locale }: { readonly locale: Locale }) {
  const text = copy[locale];
  return (
    <Card padding={8} className={styles.cta}>
      <div>
        <h3>{text.ctaTitle}</h3>
        <p>{text.ctaBody}</p>
      </div>
      <Button
        label={text.edit}
        href="https://github.com/jongminchung/jongminchung"
        target="_blank"
        rel="noreferrer"
        variant="primary"
        size="lg"
      />
    </Card>
  );
}
