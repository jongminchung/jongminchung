import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";
import { createRemarkPlugins } from "./remark-plugins.ts";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
    experimental: {
        globalNotFound: true,
    },
    pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
    output: "standalone",
    outputFileTracingRoot: resolve(appRoot, "../.."),
    reactStrictMode: true,
    transpilePackages: ["@jongminchung/ui"],
} satisfies NextConfig;

const withMDX = createMDX({
    extension: /\.mdx?$/,
    options: {
        remarkPlugins: createRemarkPlugins(),
        rehypePlugins: ["rehype-slug"],
    },
});

export default withMDX(nextConfig);
