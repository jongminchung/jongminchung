import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorialImage } from "./EditorialImage";

describe("EditorialImage", () => {
  it("단일 이미지와 사용자 정의 속성을 그대로 렌더링함", () => {
    const markup = renderToStaticMarkup(
      <EditorialImage
        alt="Editorial subject"
        data-image-contract="single"
        eager
        height={1024}
        src="/tech/articles/article.png"
        width={1536}
      />,
    );

    expect(markup.match(/<img\b/gu)).toHaveLength(1);
    expect(markup).toContain('data-image-contract="single"');
    expect(markup).toContain("article.png");
    expect(markup).toContain('fetchPriority="high"');
    expect(markup).toContain('loading="eager"');
  });

  it("목록의 후속 이미지는 지연 로딩함", () => {
    const markup = renderToStaticMarkup(
      <EditorialImage
        alt="Later article"
        height={900}
        src="/later.png"
        width={1600}
      />,
    );

    expect(markup).toContain('loading="lazy"');
    expect(markup).not.toContain('fetchPriority="high"');
  });
});
