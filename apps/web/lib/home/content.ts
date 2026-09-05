import { siteOrigins, type Locale } from "#lib/site-routing";

interface HomeDestination {
  readonly id: "tech" | "invest";
  readonly title: string;
  readonly description: string;
  readonly topics: readonly string[];
  readonly action: string;
  readonly href: string;
}

interface HomeContent {
  readonly navigation: {
    readonly label: string;
    readonly skipToContent: string;
    readonly writing: string;
    readonly principles: string;
    readonly switchLocale: string;
  };
  readonly hero: {
    readonly title: readonly [string, string];
    readonly description: string;
    readonly readLatest: string;
  };
  readonly destinationsLabel: string;
  readonly destinations: readonly HomeDestination[];
  readonly writing: {
    readonly title: string;
    readonly description: string;
    readonly viewAll: string;
    readonly empty: string;
  };
  readonly principles: {
    readonly title: string;
    readonly description: string;
    readonly items: readonly {
      readonly key: string;
      readonly title: string;
      readonly body: string;
    }[];
  };
  readonly footer: { readonly description: string; readonly action: string };
  readonly metadataDescription: string;
}

const content = {
  ko: {
    navigation: {
      label: "주요 탐색",
      skipToContent: "본문으로 건너뛰기",
      writing: "최근 기록",
      principles: "작업 원칙",
      switchLocale: "Read in English",
    },
    hero: {
      title: ["만들고, 이해하고.", "근거를 남깁니다."],
      description:
        "소프트웨어를 만드는 과정과 세상을 읽는 관점. 기술과 투자, 두 가지 기록을 이어갑니다.",
      readLatest: "최근 기록 읽기",
    },
    destinationsLabel: "탐색할 공간",
    destinations: [
      {
        id: "tech",
        title: "Tech",
        description: "직접 만들고 실험하며 배운 소프트웨어 이야기.",
        topics: ["개발", "실험", "도구"],
        action: "기술 기록 살펴보기",
        href: `${siteOrigins.tech}/ko`,
      },
      {
        id: "invest",
        title: "Invest",
        description: "공시와 원문에서 출발해 스스로 생각하는 투자 기록.",
        topics: ["공시", "원문", "리서치"],
        action: "투자 기록 살펴보기",
        href: `${siteOrigins.invest}/ko`,
      },
    ],
    writing: {
      title: "최근 기록",
      description: "각 공간에서 이어지고 있는 생각들.",
      viewAll: "모두 보기",
      empty: "새로운 기록을 준비하고 있습니다.",
    },
    principles: {
      title: "기록을 쌓는 방식",
      description: "명확한 언어, 작은 경계, 확인할 수 있는 근거.",
      items: [
        {
          key: "language",
          title: "같은 언어로",
          body: "설명과 코드, 테스트가 같은 이야기를 하도록 합니다.",
        },
        {
          key: "boundaries",
          title: "작은 단위로",
          body: "한 번에 이해하고 바꿀 수 있는 크기로 나눕니다.",
        },
        {
          key: "evidence",
          title: "근거와 함께",
          body: "직접 확인한 사실과 그에 대한 생각을 구분합니다.",
        },
      ],
    },
    footer: {
      description: "배운 것을 기록하고, 다음 작업으로 이어갑니다.",
      action: "GitHub에서 작업 보기",
    },
    metadataDescription:
      "Jongmin Chung의 기술과 투자 기록. Tech에서 개발과 실험을, Invest에서 공시와 원문 기반의 리서치를 읽어보세요.",
  },
  en: {
    navigation: {
      label: "Primary navigation",
      skipToContent: "Skip to content",
      writing: "Latest notes",
      principles: "Principles",
      switchLocale: "한국어로 읽기",
    },
    hero: {
      title: ["Build with curiosity.", "Think with evidence."],
      description:
        "Notes on making software and understanding the world. Two spaces for ideas, experiments, and research.",
      readLatest: "Read the latest",
    },
    destinationsLabel: "Choose a space",
    destinations: [
      {
        id: "tech",
        title: "Tech",
        description: "Software, experiments, and lessons from building things.",
        topics: ["Development", "Experiments", "Tools"],
        action: "Explore Tech",
        href: `${siteOrigins.tech}/en`,
      },
      {
        id: "invest",
        title: "Invest",
        description:
          "Independent thinking, grounded in filings and original sources.",
        topics: ["Filings", "Sources", "Research"],
        action: "Explore Invest",
        href: `${siteOrigins.invest}/en`,
      },
    ],
    writing: {
      title: "Latest notes",
      description: "The thinking continues in each space.",
      viewAll: "View all",
      empty: "New notes are on the way.",
    },
    principles: {
      title: "How the work takes shape",
      description: "Clear language. Small boundaries. Traceable evidence.",
      items: [
        {
          key: "language",
          title: "Use the same words",
          body: "Keep the explanation, the code, and the tests in agreement.",
        },
        {
          key: "boundaries",
          title: "Keep things small",
          body: "Make each part small enough to understand and change.",
        },
        {
          key: "evidence",
          title: "Show the evidence",
          body: "Distinguish what the sources say from what I think they mean.",
        },
      ],
    },
    footer: {
      description: "Learn something. Write it down. Build on it.",
      action: "Find the work on GitHub",
    },
    metadataDescription:
      "Jongmin Chung’s notes on technology and investing. Explore software and experiments in Tech, and source-based research in Invest.",
  },
} as const satisfies Record<Locale, HomeContent>;

/** Home의 문구와 Tech·Invest 목적지를 한곳에서 관리한다. */
export function getHomeContent(locale: Locale): HomeContent {
  return content[locale];
}

export const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Jongmin Chung",
  alternateName: "Jamie",
  url: siteOrigins.home,
  sameAs: ["https://github.com/jongminchung"],
  knowsAbout: [
    "Domain-Driven Design",
    "TypeScript",
    "Next.js",
    "Developer tooling",
    "Investment research",
  ],
} as const;
