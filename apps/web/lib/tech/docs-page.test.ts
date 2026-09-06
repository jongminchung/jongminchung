import { describe, expect, it } from "bun:test";
import { readPublishedTechContent } from "../content-repository";
import { resolveTechDocsPageFromContent } from "./docs-page";
import { docsOverviewForSeries, legacyVscodeArticleHref } from "./routing";

describe("Tech Docs page model", () => {
  const content = readPublishedTechContent();

  it("[성공] VS Code를 번역·탐색 가능한 Docs로 제공하고 이전 주소를 연결함", () => {
    for (const locale of ["ko", "en"] as const) {
      const model = resolveTechDocsPageFromContent(locale, ["vscode"], content);
      expect(model.kind).toBe("article");
      if (model.kind !== "article")
        throw new Error("Missing VS Code Docs area.");
      expect(model.page.href).toBe(`/${locale}/docs/vscode`);
      expect(model.publicUrls).toContain(`/${locale}/docs/vscode/resources`);
      expect(model.publicUrls).toContain(`/${locale}/docs/vscode/oxfmt-oxlint`);
      expect(model.alternatePage.locale).not.toBe(locale);
      expect(
        content.blogPosts.some((post) => post.id === "vscode-editorconfig"),
      ).toBe(false);
      expect(docsOverviewForSeries(locale, "vscode-format-and-lint")).toBe(
        model.page.href,
      );
      expect(legacyVscodeArticleHref(locale, "vscode-go")).toBe(
        `/${locale}/docs/vscode/go-format`,
      );
    }
    expect(legacyVscodeArticleHref("ko", "constructor")).toBeNull();
    expect(legacyVscodeArticleHref("ko", "unknown")).toBeNull();
  });

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
