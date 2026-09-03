import { describe, expect, it } from "bun:test";
import { parseBlogContentPath, parseDocsContentPath } from "./content-path";

describe("Tech content path identity", () => {
  it("[성공] Blog locale과 ID를 파일 경로에서 도출함", () => {
    expect(parseBlogContentPath("ko/nextjs-16.mdx")).toEqual({
      locale: "ko",
      id: "nextjs-16",
    });
    expect(parseBlogContentPath("en\\pnpm-11.mdx")).toEqual({
      locale: "en",
      id: "pnpm-11",
    });
  });

  it("[성공] Docs root·area·문서 identity를 경로에서 도출함", () => {
    expect(parseDocsContentPath("en/index.mdx")).toEqual({
      locale: "en",
      id: "docs-overview",
    });
    expect(parseDocsContentPath("ko/fe/index.mdx")).toEqual({
      locale: "ko",
      area: "fe",
      id: "fe-overview",
    });
    expect(
      parseDocsContentPath("en/be/domain-driven-design.mdx", true),
    ).toEqual({
      locale: "en",
      area: "be",
      id: "domain-driven-design-overview",
    });
    expect(
      parseDocsContentPath("ko/k8s/cilium-gateway-api-foundations.mdx"),
    ).toEqual({
      locale: "ko",
      area: "k8s",
      id: "cilium-gateway-api-foundations",
    });
  });

  it("[실패] 잘못된 locale·깊이·확장자·중복 overview 선언을 거부함", () => {
    expect(() => parseBlogContentPath("ja/post.mdx")).toThrow(
      "unsupported content locale",
    );
    expect(() => parseBlogContentPath("ko/series/post.mdx")).toThrow(
      "unsupported content path depth",
    );
    expect(() => parseDocsContentPath("ko/fe/post.md")).toThrow(
      "must use .mdx",
    );
    expect(() => parseDocsContentPath("ko/fe/index.mdx", true)).toThrow(
      "derived from path",
    );
  });
});
