import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Callout, Card, Step, Steps } from "./DocsMdxPrimitives";
import { MdxTable } from "./mdx-components";

describe("Tech MDX composition", () => {
  it("[성공] 순서 있는 단계의 native list semantics를 유지함", () => {
    const html = renderToStaticMarkup(
      createElement(
        Steps,
        null,
        createElement(Step, null, "Inspect"),
        createElement(Step, null, "Verify"),
      ),
    );
    expect(html).toContain("<ol");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain('data-docs-steps="true"');
  });

  it("[성공] Callout에 이름 있는 note semantics를 제공함", () => {
    const html = renderToStaticMarkup(
      Callout({
        children: "Verify generated CSS",
        title: "Build contract",
        type: "warning",
      }),
    );
    expect(html).toContain('role="note"');
    expect(html).toContain('aria-label="Build contract"');
    expect(html).toContain('data-callout-type="warning"');
  });

  it("[성공] 링크 카드에 keyboard focus 표현을 제공함", () => {
    const html = renderToStaticMarkup(
      createElement(Card, { href: "/en/reference", title: "Reference" }),
    );
    expect(html).toContain('href="/en/reference"');
    expect(html).toContain("focus-visible:outline-ring");
  });

  it("[성공] 넓은 표를 본문 폭 안의 독립 스크롤 영역으로 렌더링함", () => {
    const html = renderToStaticMarkup(
      createElement(
        MdxTable,
        null,
        createElement(
          "tbody",
          null,
          createElement("tr", null, createElement("td", null, "Contract")),
        ),
      ),
    );

    expect(html).toContain('data-docs-table-scroll="true"');
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("min-w-[560px]");
    expect(html).toContain("<table");
  });
});
