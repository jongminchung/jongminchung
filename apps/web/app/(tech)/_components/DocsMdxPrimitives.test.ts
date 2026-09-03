import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { articleProseClassName, docsProseClassName } from "#lib/mdx-styles";
import {
  articleMdxComponents,
  docsMdxComponents,
  sharedMdxComponents,
} from "#mdx-components";
import { Callout, Card, Step, Steps } from "./DocsMdxPrimitives";
import { SharedMdxTable } from "./mdx-components";

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
        SharedMdxTable,
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

    expect(html).toContain("mt-0 mb-4");
    expect(html).not.toContain("text-base");
    expect(html).toContain("content-override");
  });

  it("[성공] 비순서 목록 marker를 옅은 semantic 색상으로 표시함", () => {
    for (const component of [docsMdxComponents.ul, articleMdxComponents.ul]) {
      const html = renderToStaticMarkup(
        createElement(
          component,
          null,
          createElement("li", null, "Read documentation"),
        ),
      );

      expect(html).toContain("list-disc");
      expect(html).toContain("[&amp;&gt;li]:marker:text-border");
      expect(html).toContain("<li>Read documentation</li>");
    }
  });

  it("[성공] 순서형 목록 marker를 읽기 쉬운 보조 색상으로 표시함", () => {
    for (const component of [docsMdxComponents.ol, articleMdxComponents.ol]) {
      const html = renderToStaticMarkup(
        createElement(component, null, createElement("li", null, "First step")),
      );

      expect(html).toContain("list-decimal");
      expect(html).toContain("[&amp;&gt;li]:marker:text-muted-foreground");
      expect(html).toContain("<li>First step</li>");
    }
  });

  it("[성공] Docs와 Article이 공통 목록 semantics를 공유함", () => {
    expect(docsMdxComponents.ul).toBe(sharedMdxComponents.ul);
    expect(docsMdxComponents.ol).toBe(sharedMdxComponents.ol);
    expect(articleMdxComponents.ul).toBe(sharedMdxComponents.ul);
    expect(articleMdxComponents.ol).toBe(sharedMdxComponents.ol);
  });

  it("[성공] Docs와 Article 제목 리듬을 읽기 목적에 맞게 분리함", () => {
    const docsHeading = renderToStaticMarkup(
      createElement(docsMdxComponents.h2, null, "Configure the API"),
    );
    const articleHeading = renderToStaticMarkup(
      createElement(articleMdxComponents.h2, null, "Designing the system"),
    );

    expect(docsHeading).toContain("mt-7 mb-2");
    expect(docsHeading).toContain("text-[20px] leading-[26px]");
    expect(articleHeading).toContain("mt-[52px] mb-[26px]");
    expect(articleHeading).toContain("text-[26px] leading-[1.5]");
  });

  it("[성공] 한글과 영어에 서로 다른 읽기 리듬을 제공함", () => {
    for (const className of [
      articleProseClassName("ko"),
      docsProseClassName("ko"),
    ]) {
      expect(className).toContain("break-keep");
      expect(className).toContain("leading-7");
    }

    for (const className of [
      articleProseClassName("en"),
      docsProseClassName("en"),
    ]) {
      expect(className).toContain("leading-[1.6]");
      expect(className).toContain("tracking-normal");
    }
  });
});
