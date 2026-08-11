import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./topics/modeling-series-view-model/TableRenderer.tsx", import.meta.url),
  "utf8",
);

describe("TableRenderer accessibility contract", () => {
  it("keeps sorting and pagination on named buttons", () => {
    expect(source).toContain("aria-sort={");
    expect(source).toContain("aria-label={`${column.label} 정렬`}");
    expect(source).toContain('aria-label="이전 페이지"');
    expect(source).toContain('aria-label="다음 페이지"');
    expect(source.match(/type="button"/g)).toHaveLength(5);
  });

  it("keeps clickable rows keyboard-operable", () => {
    expect(source).toContain('event.key !== "Enter" && event.key !== " "');
    expect(source).toContain("tabIndex={onClick ? 0 : undefined}");
    expect(source).toContain("onKeyDown={onClick ? handleKeyDown : undefined}");
  });
});
