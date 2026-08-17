import { fileURLToPath } from "node:url";
import type { CompileOptions } from "@mdx-js/mdx";
import type createMDX from "@next/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { remarkKroki } from "remark-kroki";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

type PluggableList = NonNullable<CompileOptions["remarkPlugins"]>;
type NextMdxOptions = NonNullable<Parameters<typeof createMDX>[0]>;
type NextRemarkPlugins = NonNullable<
    NonNullable<NextMdxOptions["options"]>["remarkPlugins"]
>;

const publicKrokiServer = "https://kroki.io";
const remarkKrokiAdapter = fileURLToPath(
    new URL("./remark-kroki-next.ts", import.meta.url),
);

function krokiOptions(server: string) {
    return {
        alias: ["plantuml"],
        output: "img-base64",
        server,
        target: "mdx3",
    };
}

export function createRemarkPlugins(): NextRemarkPlugins {
    return [
        "remark-gfm",
        "remark-frontmatter",
        ["remark-mdx-frontmatter", { name: "metadata" }],
        [remarkKrokiAdapter, krokiOptions(publicKrokiServer)],
    ];
}

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
