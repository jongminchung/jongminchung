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
    target("en", "Next.js 16 App Router", "deep-dive/nextjs-16"),
    target("en", "pnpm workspace catalog", "deep-dive/pnpm-11"),
    target("en", "Node.js type stripping", "deep-dive/node-26"),
    target(
        "en",
        "TypeScript Compiler API",
        "deep-dive/typescript-7-compatibility",
    ),
    target("en", "createProgram", "deep-dive/typescript-7-compatibility"),
    target("en", "noUncheckedIndexedAccess", "deep-dive/typescript-6"),
    target(
        "en",
        "browser main thread frame budget",
        "deep-dive/the-expensive-main-thread",
    ),
    target(
        "en",
        "headless React accessibility",
        "deep-dive/headless-react-component",
    ),
    target(
        "en",
        "cache stampede invalidation",
        "deep-dive/frontend-caching-strategies",
    ),
    target(
        "en",
        "cursor tombstone fanout",
        "deep-dive/do-we-really-know-pagination",
    ),
    target("en", "Little's Law latency", "deep-dive/throughput-and-latency"),
    target("en", "SMTP reply parser", "deep-dive/building-email-relay-system"),
    target("en", "6502 CPU PPU", "deep-dive/building-nes-emulator"),
    target(
        "en",
        "zero knowledge encrypted vault",
        "deep-dive/encrypted-share-vault-system",
    ),
    target("en", "bounded context aggregate", "handbook/ddd"),
    target("en", "coding agent tool calls", "deep-dive/building-coding-agent"),
    target("en", "S-expression REPL", "deep-dive/hamssun-python-lisp"),
    target(
        "en",
        "genome crossover mutation",
        "deep-dive/implementing-genetic-algorithm",
    ),
    noResults("en", "Kubernetes ingress controller"),
    noResults("en", "PostgreSQL vacuum freeze"),

    target("ko", "Next.js 16 서버 컴포넌트", "deep-dive/nextjs-16"),
    target("ko", "pnpm워크스페이스catalog", "deep-dive/pnpm-11"),
    target("ko", "Node.js 타입 제거 실행", "deep-dive/node-26"),
    target(
        "ko",
        "TypeScript Compiler API",
        "deep-dive/typescript-7-compatibility",
    ),
    target("ko", "createProgram", "deep-dive/typescript-7-compatibility"),
    target("ko", "noUncheckedIndexedAccess", "deep-dive/typescript-6"),
    target("ko", "브라우저메인스레드", "deep-dive/the-expensive-main-thread"),
    target("ko", "Headless React 접근성", "deep-dive/headless-react-component"),
    target("ko", "캐시계층", "deep-dive/frontend-caching-strategies"),
    target(
        "ko",
        "커서 tombstone fanout",
        "deep-dive/do-we-really-know-pagination",
    ),
    target("ko", "Little의법칙지연시간", "deep-dive/throughput-and-latency"),
    target("ko", "SMTP 회신 파서", "deep-dive/building-email-relay-system"),
    target("ko", "6502 CPU PPU", "deep-dive/building-nes-emulator"),
    target("ko", "영지식경계", "deep-dive/encrypted-share-vault-system"),
    target("ko", "경계컨텍스트", "handbook/ddd"),
    target("ko", "코딩에이전트", "deep-dive/building-coding-agent"),
    target("ko", "S-expression REPL", "deep-dive/hamssun-python-lisp"),
    target("ko", "교차와돌연변이", "deep-dive/implementing-genetic-algorithm"),
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
        bytes: 1_040_636,
        initialRequestCount: 1,
        runtimeDependencyBytes: 0,
    }),
});
