import createMDX from "@next/mdx";
import { createRemarkPlugins } from "./remark-plugins.mjs";

const nextConfig = {
    experimental: {
        globalNotFound: true,
    },
    pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
    reactStrictMode: true,
    transpilePackages: ["@jongminchung/icon", "@jongminchung/ui"],
};

const withMDX = createMDX({
    extension: /\.mdx?$/,
    options: {
        remarkPlugins: createRemarkPlugins(),
        rehypePlugins: ["rehype-slug"],
    },
});

export default withMDX(nextConfig);
