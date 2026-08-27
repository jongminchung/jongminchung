import {
  bilingualSearchBenchmarkCases,
  type SearchBenchmarkCase,
} from "../lib/tech/search-benchmark.ts";
import { searchTechDocuments } from "../lib/tech/search-server.ts";

export interface ServerSearchBenchmarkReport {
  readonly meanReciprocalRank: number;
  readonly noResultAccuracy: number;
  readonly positiveQueries: number;
  readonly queries: number;
  readonly top1HitRate: number;
  readonly top3HitRate: number;
  readonly unexpectedZeroResultRate: number;
  readonly zeroResultRate: number;
}

/** 실제 ZBSearch 서버에 corpus를 실행하고 relevance 지표를 계산함 */
export async function evaluateServerSearchBenchmark(
  cases: readonly SearchBenchmarkCase[],
): Promise<ServerSearchBenchmarkReport> {
  let top1 = 0;
  let top3 = 0;
  let reciprocalRank = 0;
  let positiveQueries = 0;
  let noResultQueries = 0;
  let correctNoResults = 0;
  let unexpectedNoResults = 0;

  for (const benchmark of cases) {
    const results = await searchTechDocuments(
      benchmark.query,
      benchmark.locale,
    );
    const ids = results
      .filter(({ type }) => type === "page")
      .map(({ url }) => url.split("/").at(-1) ?? "");
    if (benchmark.expectNoResults === true) {
      noResultQueries += 1;
      if (ids.length === 0) correctNoResults += 1;
      continue;
    }
    positiveQueries += 1;
    const rank = ids.findIndex((id) => benchmark.expectedIds.includes(id)) + 1;
    if (rank === 0) {
      unexpectedNoResults += Number(ids.length === 0);
      continue;
    }
    if (rank === 1) top1 += 1;
    if (rank <= 3) top3 += 1;
    reciprocalRank += 1 / rank;
  }

  return Object.freeze({
    queries: cases.length,
    positiveQueries,
    top1HitRate: top1 / positiveQueries,
    top3HitRate: top3 / positiveQueries,
    meanReciprocalRank: reciprocalRank / positiveQueries,
    noResultAccuracy: correctNoResults / noResultQueries,
    zeroResultRate: noResultQueries / cases.length,
    unexpectedZeroResultRate: unexpectedNoResults / positiveQueries,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(
    `${JSON.stringify(await evaluateServerSearchBenchmark(bilingualSearchBenchmarkCases))}\n`,
  );
}
