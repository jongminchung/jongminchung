import type { Locale } from "#lib/site-routing";

export interface Project {
  readonly category: string;
  readonly description: string;
  readonly href: string;
  readonly index: string;
  readonly tags: readonly string[];
  readonly title: string;
}

export interface Principle {
  readonly body: string;
  readonly key: string;
  readonly title: string;
}

interface HomeContent {
  readonly hero: {
    readonly title: readonly [string, string, string];
    readonly lead: string;
    readonly workAction: string;
    readonly techAction: string;
  };
  readonly projects: readonly Project[];
  readonly principles: readonly Principle[];
}

const content = {
  en: {
    hero: {
      title: ["Complex systems", "should explain", "themselves."],
      lead: "I turn shared language into clear boundaries and working software.",
      workAction: "Read the work",
      techAction: "Open Engineering Notes",
    },
    projects: [
      {
        index: "01",
        category: "Technology publication",
        title: "Engineering Notes",
        description:
          "Bilingual articles, handbooks, and deep dives about building understandable software.",
        tags: ["Next.js", "MDX", "Engineering"],
        href: "https://tech.jamie.kr/en",
      },
      {
        index: "02",
        category: "Investment research",
        title: "Investment Notes",
        description:
          "13F filings and original investment sources analyzed with reported facts kept separate from interpretation.",
        tags: ["Research", "Sources", "Bilingual"],
        href: "https://invest.jamie.kr/en",
      },
    ],
    principles: [
      {
        key: "language",
        title: "Language is architecture.",
        body: "Meetings, issues, APIs, and tests should use the same words.",
      },
      {
        key: "boundaries",
        title: "Boundaries earn their keep.",
        body: "External values are translated before an internal model trusts them.",
      },
      {
        key: "evidence",
        title: "Evidence ships with change.",
        body: "Tests make intent observable and keep the cost of change inside its boundary.",
      },
    ],
  },
  ko: {
    hero: {
      title: ["복잡한 시스템은", "스스로 설명할 수", "있어야 함"],
      lead: "공유 언어를 명확한 경계와 동작하는 소프트웨어로 옮김",
      workAction: "프로젝트 보기",
      techAction: "기술 글 읽기",
    },
    projects: [
      {
        index: "01",
        category: "기술 아카이브",
        title: "Engineering Notes",
        description:
          "이해할 수 있는 소프트웨어를 만들기 위한 글과 Handbook·Deep Dive를 한영으로 기록함",
        tags: ["Next.js", "MDX", "Engineering"],
        href: "https://tech.jamie.kr/ko",
      },
      {
        index: "02",
        category: "투자 리서치",
        title: "Investment Notes",
        description:
          "13F 공시와 투자 원문에서 투자자의 선택과 시장 구조를 분석한 글을 한영으로 기록함",
        tags: ["Research", "Sources", "Bilingual"],
        href: "https://invest.jamie.kr/ko",
      },
    ],
    principles: [
      {
        key: "language",
        title: "언어가 아키텍처를 만듦",
        body: "회의·이슈·API·테스트에서 같은 용어를 사용함",
      },
      {
        key: "boundaries",
        title: "경계에는 이유가 필요함",
        body: "외부 값은 내부 모델이 신뢰하기 전에 번역함",
      },
      {
        key: "evidence",
        title: "변경에는 근거가 따라야 함",
        body: "테스트로 의도를 관찰할 수 있게 하고 변경 비용을 경계 안에 둠",
      },
    ],
  },
} as const satisfies Record<Locale, HomeContent>;

/** `getHomeContent` 데이터를 조회함 */
export function getHomeContent(locale: Locale): HomeContent {
  return content[locale];
}

export const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Jongmin Chung",
  alternateName: "Jamie",
  url: "https://www.jamie.kr",
  sameAs: ["https://github.com/jongminchung"],
  knowsAbout: [
    "Domain-Driven Design",
    "TypeScript",
    "Next.js",
    "Developer tooling",
    "Investment research",
  ],
} as const;
