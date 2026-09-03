import { describe, expect, it } from "bun:test";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  bilingualSearchBenchmarkBaseline,
  bilingualSearchBenchmarkCases,
  bilingualSearchBenchmarkThresholds,
} from "./search-benchmark.ts";

const execFileAsync = promisify(execFile);
const appRoot = resolve(import.meta.dirname, "../..");

describe("ZBSearch 한영 relevance benchmark", () => {
  it("실제 40개 corpus가 서버 검색 품질 하한을 충족함", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--preload",
        "./scripts/register-content-plugin.ts",
        "./scripts/search-benchmark-runner.ts",
      ],
      { cwd: appRoot },
    );
    const report = JSON.parse(stdout) as Record<string, number>;

    expect(bilingualSearchBenchmarkCases).toHaveLength(40);
    expect(report).toMatchObject({
      queries: 40,
      positiveQueries: 36,
      zeroResultRate: 0.1,
      noResultAccuracy: 1,
      unexpectedZeroResultRate: 0,
    });
    expect(report).toMatchObject(bilingualSearchBenchmarkBaseline.aggregate);
    expect(report.top1HitRate).toBeGreaterThanOrEqual(
      bilingualSearchBenchmarkThresholds.minTop1HitRate,
    );
    expect(report.top3HitRate).toBeGreaterThanOrEqual(
      bilingualSearchBenchmarkThresholds.minTop3HitRate,
    );
    expect(report.meanReciprocalRank).toBeGreaterThanOrEqual(
      bilingualSearchBenchmarkThresholds.minMeanReciprocalRank,
    );
    expect(report.noResultAccuracy).toBeGreaterThanOrEqual(
      bilingualSearchBenchmarkThresholds.minNoResultAccuracy,
    );
    expect(report.unexpectedZeroResultRate).toBeLessThanOrEqual(
      bilingualSearchBenchmarkThresholds.maxUnexpectedZeroResultRate,
    );
  });
});
