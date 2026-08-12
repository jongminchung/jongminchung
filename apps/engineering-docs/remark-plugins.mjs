import { fileURLToPath } from "node:url";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { remarkKroki } from "remark-kroki";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

const publicKrokiServer = "https://kroki.io";
const remarkKrokiAdapter = fileURLToPath(
    new URL("./remark-kroki-next.mjs", import.meta.url),
);

function krokiOptions(server) {
    return {
        alias: ["plantuml"],
        output: "img-base64",
        server,
        target: "mdx3",
    };
}

export function createRemarkPlugins() {
    return [
        "remark-gfm",
        "remark-frontmatter",
        ["remark-mdx-frontmatter", { name: "metadata" }],
        [remarkKrokiAdapter, krokiOptions(publicKrokiServer)],
    ];
}

export function createRemarkPluginImplementations({
    krokiServer = publicKrokiServer,
} = {}) {
    return [
        remarkGfm,
        remarkFrontmatter,
        [remarkMdxFrontmatter, { name: "metadata" }],
        [remarkKroki, krokiOptions(krokiServer)],
    ];
}
