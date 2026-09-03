import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DocsCodeBlock } from "./DocsCodeBlock";

describe("Fumadocs Tech code block", () => {
  it("[성공] 제목·아이콘·라인 번호와 Shiki 노드를 보존함", () => {
    const html = renderToStaticMarkup(
      <DocsCodeBlock
        data-line-numbers
        icon={'<svg data-code-icon="typescript"></svg>'}
        title="config.ts"
      >
        <code>
          <span className="line highlighted">
            <span style={{ color: "var(--shiki-light)" }}>const ready</span>
          </span>
        </code>
      </DocsCodeBlock>,
    );

    expect(html).toContain("<figure");
    expect(html).toContain('data-docs-code-block="true"');
    expect(html).toContain('data-line-numbers="true"');
    expect(html).toContain(">config.ts</figcaption>");
    expect(html).toContain('data-code-icon="typescript"');
    expect(html).toContain('class="line highlighted"');
    expect(html).toContain('aria-label="Copy Text"');
    expect(html).toContain('aria-label="Code block: config.ts (');
    expect(html).toContain("font-size:13px");
    expect(html).toContain("letter-spacing:0px");
    expect(html).toContain("line-height:1.6");
  });

  it("[성공] 문서에서 복사를 명시적으로 끌 수 있음", () => {
    const html = renderToStaticMarkup(
      <DocsCodeBlock allowCopy={false}>
        <code>pnpm run build</code>
      </DocsCodeBlock>,
    );

    expect(html).not.toContain('aria-label="Copy Text"');
    expect(html).toContain("pnpm run build");
  });

  it("[성공] 호출자가 다른 스타일을 전달해도 코드 타이포 리듬을 보존함", () => {
    const html = renderToStaticMarkup(
      <DocsCodeBlock
        viewportProps={{
          className: "custom-viewport",
          style: {
            color: "red",
            fontSize: "8px",
            letterSpacing: "1em",
            lineHeight: "1",
          },
        }}
      >
        <code>pnpm run test</code>
      </DocsCodeBlock>,
    );

    expect(html).toContain("custom-viewport");
    expect(html).toContain("color:red");
    expect(html).toContain("font-size:13px");
    expect(html).toContain("letter-spacing:0px");
    expect(html).toContain("line-height:1.6");
    expect(html).not.toContain("font-size:8px");
    expect(html).not.toContain("letter-spacing:1em");
  });
});
