import { describe, expect, it } from "vitest";
import { readPublishedTechContent } from "../content-repository";
import { resolveTechDocsPageFromContent } from "./docs-page";

describe("Tech Docs page model", () => {
  const content = readPublishedTechContent();

  it("[성공] root landing과 localized counterpart를 같은 model로 조립함", () => {
    const model = resolveTechDocsPageFromContent("en", [], content);
    expect(model.kind).toBe("landing");
    if (model.kind !== "landing") return;
    expect(model.page.href).toBe("/en/docs");
    expect(model.alternatePage.href).toBe("/ko/docs");
    expect(model.documents.every((page) => page.locale === "en")).toBe(true);
  });

  it("[성공] article navigation 입력과 공개 page tree URL을 함께 반환함", () => {
    const model = resolveTechDocsPageFromContent(
      "en",
      ["fe", "nextjs-16"],
      content,
    );
    expect(model.kind).toBe("article");
    if (model.kind !== "article") return;
    expect(model.page.id).toBe("nextjs-16");
    expect(model.alternatePage.href).toBe("/ko/docs/fe/nextjs-16");
    expect(model.publicUrls).toContain("/en/docs/fe");
    expect(model.publicUrls).toContain("/en/docs/fe/nextjs-16");
  });

  it("[성공] 과거 section URL과 이동한 Blog ID를 canonical로 redirect함", () => {
    expect(
      resolveTechDocsPageFromContent("en", ["architecture", "ddd"], content),
    ).toEqual({ kind: "redirect", destination: "/en/docs/be/ddd" });
    expect(
      resolveTechDocsPageFromContent(
        "ko",
        ["architecture", "building-llm"],
        content,
      ),
    ).toEqual({ kind: "redirect", destination: "/ko/building-llm" });
  });

  it("[실패] 지원하지 않는 locale과 문서를 not-found로 해석함", () => {
    expect(resolveTechDocsPageFromContent("ja", [], content)).toEqual({
      kind: "not-found",
    });
    expect(
      resolveTechDocsPageFromContent("en", ["fe", "missing"], content),
    ).toEqual({ kind: "not-found" });
  });
});
