import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { blogMdxComponents } from "#mdx-components";
import { Callout, Card, Step, Steps } from "./DocsMdxPrimitives";
import { DocsMdxTable, docsMdxComponents } from "./mdx-components";

describe("Docs MDX composition", () => {
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
        DocsMdxTable,
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

  it("[성공] MDX 요소의 기본 스타일과 전달 className을 함께 유지함", () => {
    const html = renderToStaticMarkup(
      createElement(
        docsMdxComponents.p,
        { className: "content-override" },
        "Body",
      ),
    );

    expect(html).toContain("mt-0 mb-4 text-base");
    expect(html).toContain("content-override");
  });

  it("[성공] 비순서 목록의 marker를 옅은 semantic 색상으로 표시함", () => {
    for (const component of [docsMdxComponents.ul, blogMdxComponents.ul]) {
      const html = renderToStaticMarkup(
        createElement(
          component,
          null,
          createElement("li", null, "Read documentation"),
        ),
      );

      expect(html).toContain("[&amp;&gt;li]:marker:text-border");
      expect(html).toContain("<li>Read documentation</li>");
    }
  });
});
