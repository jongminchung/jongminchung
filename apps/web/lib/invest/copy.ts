import type { Locale } from "../content-contracts.ts";
import type { EditorialCopy } from "../editorial.ts";

interface InvestmentMessages {
  readonly layout: {
    readonly navigation: string;
    readonly notes: string;
    readonly books: string;
    readonly explore: string;
    readonly sources: string;
  };
  readonly index: EditorialCopy;
  readonly article: {
    readonly sources: string;
    readonly updated: string;
    readonly related: string;
    readonly disclaimer: string;
    readonly topics: string;
    readonly generatedImage: string;
    readonly researchNote: string;
  };
  readonly allNotes: {
    readonly title: string;
    readonly description: string;
  };
  readonly homeMetadata: {
    readonly title: string;
    readonly description: string;
  };
  readonly siteDescription: string;
}

const messages = {
  ko: {
    layout: {
      navigation: "투자 콘텐츠 탐색",
      notes: "노트",
      books: "책",
      explore: "탐색",
      sources: "출처",
    },
    index: {
      eyebrow: "INVESTMENT NOTES",
      title: "공시와 원문에서 출발한 투자 리서치",
      description:
        "13F 공시, 책과 인터뷰를 바탕으로 투자자의 선택과 시장의 구조를 분석합니다",
      all: "모든 노트",
      newest: "최신순",
      oldest: "오래된순",
      grid: "그리드",
      list: "목록",
      loadMore: "더 보기",
      empty: "선택한 조건과 일치하는 노트가 없습니다",
      related: "관련 노트",
      controls: "노트 목록 제어",
    },
    article: {
      sources: "참고 자료",
      updated: "업데이트",
      related: "관련 노트",
      disclaimer:
        "이 글은 출처를 이해하기 위한 개인 기록이며 투자 권유가 아닙니다",
      topics: "노트 주제",
      generatedImage: "글의 주제를 바탕으로 OpenAI로 생성한 이미지",
      researchNote: "Research note",
    },
    allNotes: {
      title: "모든 투자 리서치 노트",
      description:
        "책, 공시, 공개 자료를 바탕으로 작성한 투자 리서치 글 전체 모음",
    },
    homeMetadata: {
      title: "투자 리서치 노트",
      description:
        "13F 공시와 원문 자료를 바탕으로 투자자의 선택과 시장 구조를 분석합니다",
    },
    siteDescription:
      "13F 공시, 책, 인터뷰와 투자 원문을 바탕으로 작성한 투자 리서치 글",
  },
  en: {
    layout: {
      navigation: "Investment content navigation",
      notes: "Notes",
      books: "Books",
      explore: "Explore",
      sources: "Sources",
    },
    index: {
      eyebrow: "INVESTMENT NOTES",
      title: "Investment research grounded in filings and primary sources",
      description:
        "Essays on investor decisions and market structure grounded in 13F filings, books, and interviews",
      all: "All notes",
      newest: "Newest",
      oldest: "Oldest",
      grid: "Grid",
      list: "List",
      loadMore: "Load more",
      empty: "No notes match the selected filters.",
      related: "Related notes",
      controls: "Note list controls",
    },
    article: {
      sources: "Sources",
      updated: "Updated",
      related: "Related notes",
      disclaimer: "This is a personal research note, not investment advice",
      topics: "Note topics",
      generatedImage: "Image generated with OpenAI from the article topic",
      researchNote: "Research note",
    },
    allNotes: {
      title: "All investment research notes",
      description:
        "All investment research essays grounded in books, filings, and public materials.",
    },
    homeMetadata: {
      title: "Investment research notes",
      description:
        "Investment analysis grounded in 13F filings and original materials",
    },
    siteDescription:
      "Investment essays grounded in 13F filings, books, interviews, and original sources.",
  },
} as const satisfies Record<Locale, InvestmentMessages>;

/** locale에 맞는 Invest UI와 metadata copy를 반환함 */
export function getInvestmentMessages(locale: Locale): InvestmentMessages {
  return messages[locale];
}

/** series collection 설명을 locale에 맞게 구성함 */
export function investmentSeriesDescription(
  locale: Locale,
  series: string,
): string {
  return locale === "ko"
    ? `${series} 주제를 순서대로 연결한 투자 리서치 글 모음`
    : `An ordered collection of investment research essays in the ${series} series.`;
}

/** tag collection 설명을 locale에 맞게 구성함 */
export function investmentTagDescription(locale: Locale, tag: string): string {
  return locale === "ko"
    ? `${tag} 주제를 공시와 공개 자료를 바탕으로 분석한 투자 리서치 글 모음`
    : `Investment research essays about ${tag}, grounded in filings and public materials.`;
}
