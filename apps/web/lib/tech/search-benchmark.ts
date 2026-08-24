import type { SearchBenchmarkCase, SearchBenchmarkThresholds } from "./search";

const target = (
  locale: "en" | "ko",
  query: string,
  id: string,
): SearchBenchmarkCase => ({ locale, query, expectedIds: [id] });

const noResults = (
  locale: "en" | "ko",
  query: string,
): SearchBenchmarkCase => ({
  locale,
  query,
  expectedIds: [],
  expectNoResults: true,
});

/** 실제 영문·한국어 기술 문서에서 수집한 검색 회귀 corpus 40개 */
export const bilingualSearchBenchmarkCases = Object.freeze([
  target("en", "Next.js 16 App Router", "nextjs-16"),
  target("en", "pnpm workspace catalog", "pnpm-11"),
  target("en", "Node.js type stripping", "node-26"),
  target("en", "TypeScript Compiler API", "typescript-7-compatibility"),
  target("en", "createProgram", "typescript-7-compatibility"),
  target("en", "noUncheckedIndexedAccess", "typescript-6"),
  target("en", "browser main thread frame budget", "the-expensive-main-thread"),
  target("en", "headless React accessibility", "headless-react-component"),
  target("en", "cache stampede invalidation", "frontend-caching-strategies"),
  target("en", "cursor tombstone fanout", "do-we-really-know-pagination"),
  target("en", "Little's Law latency", "throughput-and-latency"),
  target("en", "SMTP reply parser", "building-email-relay-system"),
  target("en", "6502 CPU PPU", "building-nes-emulator"),
  target(
    "en",
    "zero knowledge encrypted vault",
    "encrypted-share-vault-system",
  ),
  target("en", "bounded context aggregate", "ddd"),
  target("en", "coding agent tool calls", "building-coding-agent"),
  target("en", "S-expression REPL", "hamssun-python-lisp"),
  target("en", "genome crossover mutation", "implementing-genetic-algorithm"),
  noResults("en", "Kubernetes ingress controller"),
  noResults("en", "PostgreSQL vacuum freeze"),

  target("ko", "Next.js 16 서버 컴포넌트", "nextjs-16"),
  target("ko", "pnpm워크스페이스catalog", "pnpm-11"),
  target("ko", "Node.js 타입 제거 실행", "node-26"),
  target("ko", "TypeScript Compiler API", "typescript-7-compatibility"),
  target("ko", "createProgram", "typescript-7-compatibility"),
  target("ko", "noUncheckedIndexedAccess", "typescript-6"),
  target("ko", "브라우저메인스레드", "the-expensive-main-thread"),
  target("ko", "Headless React 접근성", "headless-react-component"),
  target("ko", "캐시계층", "frontend-caching-strategies"),
  target("ko", "커서 tombstone fanout", "do-we-really-know-pagination"),
  target("ko", "Little의법칙지연시간", "throughput-and-latency"),
  target("ko", "SMTP 회신 파서", "building-email-relay-system"),
  target("ko", "6502 CPU PPU", "building-nes-emulator"),
  target("ko", "영지식경계", "encrypted-share-vault-system"),
  target("ko", "경계컨텍스트", "ddd"),
  target("ko", "코딩에이전트", "building-coding-agent"),
  target("ko", "S-expression REPL", "hamssun-python-lisp"),
  target("ko", "교차와돌연변이", "implementing-genetic-algorithm"),
  noResults("ko", "쿠버네티스인그레스컨트롤러"),
  noResults("ko", "양자컴퓨팅큐비트얽힘"),
] satisfies readonly SearchBenchmarkCase[]);

/** 검색 품질과 전송 비용을 함께 고정하는 built-in engine baseline */
export const bilingualSearchBenchmarkThresholds = Object.freeze({
  minTop1HitRate: 0.85,
  minTop3HitRate: 0.95,
  minMeanReciprocalRank: 0.9,
  expectedZeroResultRate: 0.1,
  minNoResultAccuracy: 1,
  maxUnexpectedZeroResultRate: 0,
  maxIndexBytes: 1_100_000,
  maxRuntimeDependencyBytes: 0,
} satisfies SearchBenchmarkThresholds);

/** content snapshot 변경 시 의도적으로 검토·갱신하는 검색 품질·비용 baseline */
export const bilingualSearchBenchmarkBaseline = Object.freeze({
  aggregate: Object.freeze({
    top1HitRate: 33 / 36,
    top3HitRate: 1,
    meanReciprocalRank: 69 / 72,
    zeroResultRate: 0.1,
  }),
  en: Object.freeze({
    top1HitRate: 17 / 18,
    top3HitRate: 1,
    meanReciprocalRank: 35 / 36,
    zeroResultRate: 0.1,
  }),
  ko: Object.freeze({
    top1HitRate: 16 / 18,
    top3HitRate: 1,
    meanReciprocalRank: 17 / 18,
    zeroResultRate: 0.1,
  }),
  index: Object.freeze({
    bytes: 1_036_535,
    initialRequestCount: 1,
    runtimeDependencyBytes: 0,
  }),
});
