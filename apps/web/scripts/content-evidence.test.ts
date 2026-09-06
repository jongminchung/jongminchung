import { describe, expect, it } from "bun:test";
import {
  assessFreshness,
  checkSource,
  freshnessPolicyFor,
} from "./content-evidence.ts";

const base = {
  section: "deep-dive" as const,
  sourceUrl: "https://example.com/docs/api",
};

describe("content evidence", () => {
  it("[성공] 문서 성격별 freshness policy를 선택함", () => {
    expect(freshnessPolicyFor({ ...base, packageName: "typescript" })).toBe(
      "versioned-technology",
    );
    expect(freshnessPolicyFor({ ...base, packageName: undefined })).toBe(
      "upstream-api",
    );
    expect(
      freshnessPolicyFor({ sourceUrl: "https://kciter.so/posts/example" }),
    ).toBe("imported-source");
    expect(
      freshnessPolicyFor({ sourceUrl: "https://example.com/concepts" }),
    ).toBe("evergreen-concept");
  });

  it("[성공] threshold 경계와 미검증 문서를 구분함", () => {
    const now = new Date("2026-08-20T00:00:00Z");
    expect(
      assessFreshness(
        {
          ...base,
          packageName: "typescript",
          verifiedAt: "2026-05-22",
        },
        now,
      ).stale,
    ).toBe(false);
    expect(
      assessFreshness(
        {
          ...base,
          packageName: "typescript",
          verifiedAt: "2026-05-21",
        },
        now,
      ).stale,
    ).toBe(true);
    expect(
      assessFreshness(
        { ...base, packageName: undefined, verifiedAt: undefined },
        now,
      ),
    ).toMatchObject({ ageDays: null, stale: true });
  });
});

describe("출처 HTTP 상태 분류", () => {
  const cases = [
    [200, "ok"],
    [204, "ok"],
    [301, "redirect"],
    [302, "redirect"],
    [400, "http-error"],
    [401, "access-denied"],
    [403, "access-denied"],
    [404, "missing"],
    [405, "method-not-supported"],
    [408, "temporary-failure"],
    [410, "missing"],
    [429, "temporary-failure"],
    [500, "temporary-failure"],
    [501, "method-not-supported"],
    [503, "temporary-failure"],
  ] as const;
  for (const [status, state] of cases) {
    it(`${status} 응답을 ${state}로 분류함`, async () => {
      const result = await checkSource(
        "https://example.com/docs",
        async (_url, init) => {
          expect(init.method).toBe("HEAD");
          expect(init.redirect).toBe("manual");
          return new Response(null, { status, headers: { location: "/new" } });
        },
      );
      expect(result).toMatchObject({ state, status });
      if (state === "redirect") expect(result.destination).toBe("/new");
    });
  }
  it("네트워크 오류를 일시 실패로 분류함", async () => {
    expect(
      await checkSource("https://example.com", async () => {
        throw new Error("timeout");
      }),
    ).toEqual({ state: "temporary-failure" });
  });
});
