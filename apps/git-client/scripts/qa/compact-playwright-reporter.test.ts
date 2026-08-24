import { describe, expect, it } from "vitest";
import {
  compactFailureLines,
  compactTestResult,
  summarizeResults,
} from "./compact-playwright-reporter.ts";

function fakeTest(outcome: "expected" | "unexpected" | "flaky" | "skipped") {
  return {
    id: "test-id",
    location: { file: "/workspace/tests/app.spec.ts", line: 42 },
    outcome: () => outcome,
    titlePath: () => ["", "app.spec.ts", "restores project focus"],
  };
}

describe("콤팩트 극작가 기자", () => {
  it("[성공] 아티팩트 유지를 유지하는 동안 계약을 유지함", () => {
    const result = compactTestResult(
      fakeTest("unexpected"),
      {
        attachments: [
          {
            name: "trace",
            contentType: "application/zip",
            path: "/workspace/test-results/trace.zip",
          },
        ],
        duration: 125,
        error: {
          message: "\u001B[31mfocus mismatch\u001B[39m",
          stack: "stack",
        },
        errors: [],
      },
      "/workspace",
    );

    expect(result).toMatchObject({
      title: "restores project focus",
      file: "tests/app.spec.ts",
      line: 42,
      outcome: "unexpected",
      durationMs: 125,
      message: "focus mismatch",
      artifacts: [{ name: "trace", path: "test-results/trace.zip" }],
    });
  });

  it("[실패] 테스트 없이 로그 작성 결과를 요약함", () => {
    expect(
      summarizeResults([
        { outcome: "expected" },
        { outcome: "unexpected" },
        { outcome: "flaky" },
        { outcome: "skipped" },
      ]),
    ).toEqual({ passed: 1, failed: 1, flaky: 1, skipped: 1 });
  });

  it("[성공] 최대 5개의 실패 실패를 인쇄함", () => {
    const failures = Array.from({ length: 8 }, (_, index) => ({
      file: "tests/app.spec.ts",
      line: index + 1,
      title: `failure-${index}`,
      message: "x".repeat(2_000),
    }));

    const lines = compactFailureLines(failures);

    expect(lines).toHaveLength(5);
    expect(lines.every((line: string) => line.length < 700)).toBe(true);
  });
});
