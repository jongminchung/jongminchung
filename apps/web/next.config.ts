import { resolve } from "node:path";
import type { NextConfig } from "next";

const appRoot = import.meta.dirname;

const nextConfig = {
    experimental: {
        globalNotFound: true,
    },
    output: "standalone",
    outputFileTracingIncludes: {
        "/*": ["./content/tech/**/*.mdx", "./content/invest/**/*.mdx"],
    },
    outputFileTracingRoot: resolve(appRoot, "../.."),
    reactStrictMode: true,
    // UI를 source-first로 transpile해 dev·typecheck·build가 같은 module graph를 사용함
    transpilePackages: ["@jongminchung/ui"],
} satisfies NextConfig;

export default nextConfig;
