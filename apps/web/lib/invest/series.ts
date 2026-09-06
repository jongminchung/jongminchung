import type { Locale } from "../content-contracts.ts";

const seriesGuide = {
  ko: {
    title: "삶을 위한 경제·금융 지식",
    description:
      "첫 월급부터 집, 가족, 은퇴까지. 인생의 선택 앞에서 돈의 원리를 이해하고 스스로 판단하기 위한 시리즈입니다.",
    curriculum: "이 순서로 함께 배웁니다",
    introduction:
      "생활 속 질문에서 출발해 개념을 익히고, 가상의 사례로 계산한 뒤 내 상황에 적용할 질문을 남깁니다. 각 장을 차례로 읽으며 내 생활의 숫자를 정리해보세요.",
    published: "지금 읽을 수 있는 시리즈",
    chapters: [
      {
        id: "life-finance-1-money-and-prices",
        title: "돈과 경제를 읽는 기본 언어",
        question: "월급은 올랐는데 왜 생활은 더 빠듯할까?",
        topics: "희소성과 기회비용 · 가격과 시장 · 물가와 구매력 · 금리와 환율",
        exercise:
          "지난해와 올해의 생활비를 비교하며 명목 금액과 구매력을 구분하기",
      },
      {
        id: "life-finance-2-income-and-cash-flow",
        title: "첫 월급부터 만드는 돈의 구조",
        question: "내가 버는 돈 중 자유롭게 쓸 수 있는 돈은 얼마일까?",
        topics: "세전·세후 소득 · 현금흐름 · 고정비와 변동비 · 자산과 부채",
        exercise: "한 달 현금흐름표와 순자산표를 한 장씩 작성하기",
      },
      {
        id: "life-finance-3-savings-and-reserves",
        title: "저축과 비상자금, 선택의 여유",
        question: "갑자기 소득이 멈추면 얼마나 버틸 수 있을까?",
        topics: "저축 목표 · 유동성 · 단리와 복리 · 예금과 금융기관",
        exercise: "필수 생활비와 예상 지출로 필요한 현금의 규모를 계산하기",
      },
      {
        id: "life-finance-4-credit-and-debt",
        title: "신용과 부채를 이해하는 법",
        question: "빌릴 수 있는 돈과 갚을 수 있는 돈은 어떻게 다를까?",
        topics: "신용 · 대출금리 · 원리금 상환 · 연체와 부채 관리",
        exercise: "같은 대출의 금리와 상환 방식이 바뀔 때 월 부담 비교하기",
      },
      {
        id: "life-finance-5-housing-and-family",
        title: "집과 가족, 큰돈이 드는 선택",
        question: "집을 구하거나 가족을 꾸릴 때 무엇부터 계산할까?",
        topics: "월세·전세·매매 · 주거 총비용 · 보증금과 계약 · 공동 생활비",
        exercise: "주거비와 초기 비용을 나누고 생활 변화 전후의 예산 작성하기",
      },
      {
        id: "life-finance-6-insurance-and-protection",
        title: "보험과 안전망으로 삶을 지키기",
        question: "감당할 수 있는 손실과 대비해야 할 위험은 무엇일까?",
        topics: "위험의 빈도와 크기 · 사회보험 · 민간보험 · 보장과 면책",
        exercise: "이미 가진 보장과 빠진 위험을 표로 정리하고 중복 확인하기",
      },
      {
        id: "life-finance-7-investing-basics",
        title: "투자를 시작하기 전에 알아야 할 것",
        question: "이 돈은 언제 필요하고 어느 정도 손실을 감당할 수 있을까?",
        topics: "주식·채권·펀드 · 위험과 수익 · 분산 · 수수료와 투자 사기",
        exercise: "돈의 사용 시점별 목표와 손실 감내 범위를 문장으로 적기",
      },
      {
        id: "life-finance-8-taxes-and-retirement",
        title: "세금과 연금, 긴 시간을 설계하기",
        question: "일하는 방식이 바뀌거나 은퇴한 뒤 생활비는 어디서 올까?",
        topics:
          "세금의 기본 구조 · 공적·퇴직·개인연금 · 은퇴 현금흐름 · 정기 점검",
        exercise: "미래 생활비와 예상 소득원을 나누고 매년 확인할 항목 정하기",
      },
    ],
    exercise: "함께 해볼 일",
  },
  en: {
    title: "Economics and finance for life",
    description:
      "From your first paycheck to housing, family, and retirement. A series for understanding money and making your own decisions at life's turning points.",
    curriculum: "A path through the essentials",
    introduction:
      "Each chapter starts with an everyday question, explains the concepts, works through a hypothetical example, and leaves questions to apply to your own life. Read the chapters in order and build a record of your own finances.",
    published: "Series you can read now",
    chapters: [
      {
        id: "life-finance-1-money-and-prices",
        title: "The basic language of money and economics",
        question: "Why does life feel more expensive after a pay rise?",
        topics:
          "Scarcity and opportunity cost · Prices and markets · Inflation and purchasing power · Interest and exchange rates",
        exercise:
          "Compare living costs across two years and distinguish money amounts from purchasing power",
      },
      {
        id: "life-finance-2-income-and-cash-flow",
        title: "Building a system from your first paycheck",
        question: "How much of what I earn is actually available to spend?",
        topics:
          "Gross and net income · Cash flow · Fixed and variable costs · Assets and liabilities",
        exercise:
          "Prepare a monthly cash flow statement and a personal balance sheet",
      },
      {
        id: "life-finance-3-savings-and-reserves",
        title: "Savings, emergency funds, and room to choose",
        question: "How long could I manage if my income stopped?",
        topics:
          "Savings goals · Liquidity · Simple and compound interest · Deposits and financial institutions",
        exercise:
          "Estimate cash needs from essential living costs and upcoming expenses",
      },
      {
        id: "life-finance-4-credit-and-debt",
        title: "Understanding credit and debt",
        question: "How does what I can borrow differ from what I can repay?",
        topics:
          "Credit · Loan rates · Principal and interest · Missed payments and debt management",
        exercise:
          "Compare monthly payments when loan rates and repayment methods change",
      },
      {
        id: "life-finance-5-housing-and-family",
        title: "Housing, family, and major expenses",
        question: "What should I calculate before moving or starting a family?",
        topics:
          "Renting and buying · Korean jeonse deposits · Total housing costs · Contracts and shared budgets",
        exercise:
          "Separate upfront and recurring housing costs and budget for a life change",
      },
      {
        id: "life-finance-6-insurance-and-protection",
        title: "Insurance and safety nets",
        question: "Which losses can I absorb, and which risks need protection?",
        topics:
          "Risk frequency and severity · Social insurance · Private insurance · Coverage and exclusions",
        exercise: "Map existing protection, gaps, and overlapping coverage",
      },
      {
        id: "life-finance-7-investing-basics",
        title: "What to understand before investing",
        question: "When will I need this money, and how much loss can I bear?",
        topics:
          "Stocks, bonds, and funds · Risk and return · Diversification · Fees and investment scams",
        exercise:
          "Write down goals by time horizon and the losses you could tolerate",
      },
      {
        id: "life-finance-8-taxes-and-retirement",
        title: "Taxes, pensions, and the years ahead",
        question: "What will pay for life when my work changes or I retire?",
        topics:
          "Tax basics · Public, workplace, and personal pensions · Retirement cash flow · Regular reviews",
        exercise:
          "Map future expenses and income sources and set an annual review checklist",
      },
    ],
    exercise: "Put it into practice",
  },
} as const;

/** 삶을 위한 경제·금융 시리즈의 학습 목차를 반환함. */
export function getInvestmentSeriesGuide(locale: Locale) {
  return seriesGuide[locale];
}
