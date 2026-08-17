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
    transpilePackages: ["@jongminchung/ui"],
} satisfies NextConfig;

export default nextConfig;
