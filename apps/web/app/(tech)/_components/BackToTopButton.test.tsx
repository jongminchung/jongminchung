import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BackToTopButton } from "./BackToTopButton";

describe("BackToTopButton", () => {
  it("JavaScript 없이 페이지 시작 위치를 탐색하는 링크를 렌더링함", () => {
    const markup = renderToStaticMarkup(<BackToTopButton label="맨 위로" />);

    expect(markup).toContain('<a class="');
    expect(markup).toContain('href="#top"');
    expect(markup).toContain("맨 위로");
    expect(markup).not.toContain("<button");
  });
});
