// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  createFootnotePreviewHtml,
  footnotePreviewLabel,
} from "./footnote-preview";

describe("각주 미리보기 마크업", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("[성공] document locale에 맞는 미리보기 이름을 반환함", () => {
    expect(footnotePreviewLabel("ko")).toBe("각주 미리보기");
    expect(footnotePreviewLabel("en")).toBe("Footnote preview");
  });

  it("[성공] 설명·강조·코드를 보존하고 복귀 링크와 id를 제거함", () => {
    document.body.innerHTML = `
      <ol>
        <li id="user-content-fn-1">
          <p id="footnote-copy">Main <strong>thread</strong> and <code>setTimeout</code>
            <a data-footnote-backref href="#user-content-fnref-1">Back</a>
          </p>
        </li>
      </ol>
    `;

    const html = createFootnotePreviewHtml("#user-content-fn-1");

    expect(html).toContain("Main <strong>thread</strong>");
    expect(html).toContain("<code>setTimeout</code>");
    expect(html).not.toContain("data-footnote-backref");
    expect(html).not.toContain("footnote-copy");
  });

  it("[성공] 원시 URL과 Markdown 링크를 안전한 새 탭 링크로 정규화함", () => {
    document.body.innerHTML = `
      <li id="user-content-fn-source">
        <p>
          <a href="https://example.com/raw">https://example.com/raw</a>
          <a href="https://example.com/named">Named source</a>
        </p>
      </li>
    `;

    const html = createFootnotePreviewHtml("#user-content-fn-source");
    const container = document.createElement("div");
    container.innerHTML = html ?? "";

    const links = [...container.querySelectorAll("a")];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link.target).toBe("_blank");
      expect(link.rel).toBe("noopener noreferrer");
    }
  });

  it("[성공] 연결 대상이 없거나 해시가 잘못되면 미리보기를 만들지 않음", () => {
    expect(createFootnotePreviewHtml("/another-page")).toBeNull();
    expect(createFootnotePreviewHtml("#missing-footnote")).toBeNull();
    expect(createFootnotePreviewHtml("#%E0%A4%A")).toBeNull();
  });
});
