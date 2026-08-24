import type { CompileOptions } from "@mdx-js/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { remarkKroki } from "remark-kroki";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

type PluggableList = NonNullable<CompileOptions["remarkPlugins"]>;

const publicKrokiServer = "https://kroki.io";

function krokiOptions(server: string) {
  return {
    alias: ["plantuml"],
    output: "img-base64",
    server,
    target: "mdx3",
  };
}

/** `createRemarkPluginImplementations` 결과를 생성함 */
export function createRemarkPluginImplementations({
  krokiServer = publicKrokiServer,
}: { readonly krokiServer?: string } = {}): PluggableList {
  return [
    remarkGfm,
    remarkFrontmatter,
    [remarkMdxFrontmatter, { name: "metadata" }],
    [remarkKroki, krokiOptions(krokiServer)],
  ];
}
