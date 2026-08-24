import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MergeReadinessSummary } from "./HostingRequestDetails";

describe("Hosting merge readiness summary", () => {
  it("[성공] blocked 원인과 provider capability를 read-only로 표시함", () => {
    const markup = renderToStaticMarkup(
      <MergeReadinessSummary
        readiness={{
          state: "blocked",
          reasons: ["conflicts", "review-required"],
          capabilities: {
            checks: false,
            reviews: false,
            conflicts: true,
            branchUpdate: true,
          },
          checkedAt: "2026-08-20T00:00:00.000Z",
        }}
      />,
    );

    expect(markup).toContain("Merge readiness · blocked");
    expect(markup).toContain("Conflicts must be resolved");
    expect(markup).toContain("Required review is missing");
    expect(markup).toContain("checks unknown");
  });

  it("[경계] 권한 부족과 rate limit을 merge 가능으로 오인하지 않음", () => {
    for (const reason of ["permission-denied", "rate-limited"] as const) {
      const markup = renderToStaticMarkup(
        <MergeReadinessSummary
          readiness={{
            state: "unknown",
            reasons: [reason],
            capabilities: {
              checks: true,
              reviews: true,
              conflicts: true,
              branchUpdate: true,
            },
            checkedAt: "2026-08-20T00:00:00.000Z",
          }}
        />,
      );
      expect(markup).toContain("Merge readiness · unknown");
      expect(markup).not.toContain("Merge readiness · ready");
    }
  });
});
