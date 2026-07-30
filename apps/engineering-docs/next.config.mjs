import createMDX from "@next/mdx";

const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactStrictMode: true,
  transpilePackages: ["@jongminchung/icon", "@jongminchung/ui"],
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [
      "remark-gfm",
      "remark-frontmatter",
      ["remark-mdx-frontmatter", { name: "metadata" }],
    ],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
