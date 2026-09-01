import type { Locale } from "#lib/content-model";

interface TechMessages {
  readonly shell: {
    readonly navigation: string;
    readonly blog: string;
    readonly series: string;
    readonly showcase: string;
    readonly docs: string;
    readonly chooseDocsArea: string;
    readonly allDocs: string;
    readonly explore: string;
    readonly collections: string;
    readonly language: string;
    readonly alternateLocaleShort: string;
    readonly alternateLanguage: string;
    readonly mobileMenu: string;
    readonly closeMenu: string;
  };
  readonly article: {
    readonly argument: string;
    readonly thesis: string;
    readonly counterargument: string;
    readonly generatedImage: string;
    readonly related: string;
    readonly pagination: string;
    readonly previous: string;
    readonly next: string;
    readonly breadcrumb: string;
    readonly articles: string;
    readonly updated: string;
    readonly verified: string;
    readonly source: string;
    readonly edit: string;
    readonly blog: string;
    readonly engineeringArticle: string;
    readonly copy: string;
    readonly copied: string;
    readonly copyFailed: string;
    readonly mobileToc: string;
  };
  readonly docs: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly categories: string;
    readonly allCategories: string;
    readonly explore: string;
    readonly documents: string;
    readonly onThisPage: string;
    readonly source: string;
    readonly edit: string;
    readonly updated: string;
    readonly verified: string;
    readonly previous: string;
    readonly next: string;
    readonly openMenu: string;
    readonly pagination: string;
    readonly breadcrumb: string;
    readonly mobileNavigation: string;
    readonly mobileNavigationLabel: string;
    readonly mobileToc: string;
  };
  readonly metadata: {
    readonly blogTitle: string;
    readonly blogDescription: string;
    readonly seriesTitle: string;
    readonly seriesDescription: string;
    readonly showcaseTitle: string;
    readonly showcaseDescription: string;
    readonly latestArticles: string;
    readonly orderedCollections: string;
    readonly llmsBlog: string;
    readonly llmsDocs: string;
    readonly seriesLabel: string;
    readonly siteDescription: string;
  };
}

const messages = {
  ko: {
    shell: {
      navigation: "기술 콘텐츠 탐색",
      blog: "Blog",
      series: "Series",
      showcase: "Showcase",
      docs: "Docs",
      chooseDocsArea: "문서 분야 선택",
      allDocs: "모든 문서",
      explore: "탐색",
      collections: "모음",
      language: "언어",
      alternateLocaleShort: "EN",
      alternateLanguage: "English",
      mobileMenu: "기술 콘텐츠 메뉴",
      closeMenu: "메뉴 닫기",
    },
    article: {
      argument: "글의 논지",
      thesis: "이 글의 주장",
      counterargument: "가장 강한 반론",
      generatedImage: "글의 주제를 바탕으로 OpenAI로 생성한 이미지",
      related: "관련 글",
      pagination: "이전 및 다음 문서",
      previous: "이전",
      next: "다음",
      breadcrumb: "현재 위치",
      articles: "Articles",
      updated: "업데이트",
      verified: "검증일",
      source: "근거 자료",
      edit: "이 페이지 편집",
      blog: "블로그",
      engineeringArticle: "기술 글",
      copy: "본문 복사",
      copied: "복사됨",
      copyFailed: "복사 실패",
      mobileToc: "이 글에서",
    },
    docs: {
      eyebrow: "ENGINEERING DOCUMENTATION",
      title: "Docs",
      description:
        "업무 중 다시 찾을 기술 지식을 주제와 학습 순서에 따라 탐색할 수 있는 문서 모음",
      categories: "문서 분야",
      allCategories: "모든 문서 분야",
      explore: "문서 살펴보기",
      documents: "문서",
      onThisPage: "이 페이지에서",
      source: "근거 자료",
      edit: "이 페이지 편집",
      updated: "업데이트",
      verified: "검증",
      previous: "이전 문서",
      next: "다음 문서",
      openMenu: "이 분야의 문서 목록",
      pagination: "문서 페이지 이동",
      breadcrumb: "현재 위치",
      mobileNavigation: "모바일 문서 탐색",
      mobileNavigationLabel: "문서 탐색",
      mobileToc: "이 페이지의 목차",
    },
    metadata: {
      blogTitle: "기술 블로그",
      blogDescription: "소프트웨어를 이해하기 쉽게 만드는 방법에 관한 기술 글",
      seriesTitle: "블로그 시리즈",
      seriesDescription: "순서에 따라 읽는 기술 블로그 글 모음",
      showcaseTitle: "애니메이션 쇼케이스",
      showcaseDescription:
        "인터랙티브 타임라인과 코드 기반 설명 애니메이션의 제작 모델을 비교합니다.",
      latestArticles: "최신 기술 글",
      orderedCollections: "순서 있는 글 모음",
      llmsBlog: "한국어 Blog",
      llmsDocs: "한국어 Docs",
      seriesLabel: "시리즈",
      siteDescription: "소프트웨어를 이해하기 쉽게 만드는 기술 문서와 글",
    },
  },
  en: {
    shell: {
      navigation: "Engineering content navigation",
      blog: "Blog",
      series: "Series",
      showcase: "Showcase",
      docs: "Docs",
      chooseDocsArea: "Choose a docs area",
      allDocs: "All Docs",
      explore: "Explore",
      collections: "Collections",
      language: "Language",
      alternateLocaleShort: "KO",
      alternateLanguage: "한국어",
      mobileMenu: "Engineering content menu",
      closeMenu: "Close menu",
    },
    article: {
      argument: "Article argument",
      thesis: "Thesis",
      counterargument: "Strongest counterargument",
      generatedImage: "Image generated with OpenAI from the article topic",
      related: "Related articles",
      pagination: "Previous and next documents",
      previous: "Previous",
      next: "Next",
      breadcrumb: "Breadcrumb",
      articles: "Articles",
      updated: "Updated",
      verified: "Verified",
      source: "Source",
      edit: "Edit this page",
      blog: "Blog",
      engineeringArticle: "Engineering article",
      copy: "Copy article",
      copied: "Copied",
      copyFailed: "Copy failed",
      mobileToc: "In this article",
    },
    docs: {
      eyebrow: "ENGINEERING DOCUMENTATION",
      title: "Docs",
      description:
        "Topic-oriented engineering documentation designed for learning and quick reference during real work.",
      categories: "Documentation areas",
      allCategories: "All documentation areas",
      explore: "Explore documentation",
      documents: "Documents",
      onThisPage: "On this page",
      source: "Source",
      edit: "Edit this page",
      updated: "Updated",
      verified: "Verified",
      previous: "Previous",
      next: "Next",
      openMenu: "Documents in this area",
      pagination: "Document pagination",
      breadcrumb: "Breadcrumb",
      mobileNavigation: "Mobile documentation",
      mobileNavigationLabel: "Documentation",
      mobileToc: "On this page",
    },
    metadata: {
      blogTitle: "Engineering Blog",
      blogDescription:
        "Technical articles about building understandable software.",
      seriesTitle: "Blog Series",
      seriesDescription: "Ordered collections of engineering blog articles.",
      showcaseTitle: "Animation Showcase",
      showcaseDescription:
        "Compare interactive timelines with code-authored explanatory animation.",
      latestArticles: "Latest technical articles",
      orderedCollections: "Ordered article collections",
      llmsBlog: "English Blog",
      llmsDocs: "English Docs",
      seriesLabel: "Series",
      siteDescription:
        "Engineering documentation and articles about building understandable software.",
    },
  },
} as const satisfies Record<Locale, TechMessages>;

/** locale에 맞는 Tech Server Component용 typed copy를 반환함 */
export function getTechMessages(locale: Locale): TechMessages {
  return messages[locale];
}
