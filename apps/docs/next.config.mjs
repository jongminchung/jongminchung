import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";

const astryxJsxRuntimeLoaderPath = fileURLToPath(
  new URL("./scripts/astryx-jsx-runtime-loader.cjs", import.meta.url),
);
const isProduction = process.env.NODE_ENV === "production";

const nextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactStrictMode: true,
  transpilePackages: ["@jongminchung/icon"],
  ...(isProduction
    ? {
        turbopack: {
          rules: {
            "{*,astryx-production-jsx-runtime}": {
              loaders: [astryxJsxRuntimeLoaderPath],
              condition: {
                all: [
                  "production",
                  "foreign",
                  { path: /[\\/]@astryxdesign[\\/]core[\\/]dist[\\/].*\.js$/ },
                  { content: /react\/jsx-dev-runtime/ },
                ],
              },
              as: "*.js",
            },
          },
        },
        webpack(config) {
          config.module.rules.push({
            test: /\.js$/,
            include: /[\\/]@astryxdesign[\\/]core[\\/]dist[\\/]/,
            use: [astryxJsxRuntimeLoaderPath],
          });
          return config;
        },
      }
    : {}),
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
