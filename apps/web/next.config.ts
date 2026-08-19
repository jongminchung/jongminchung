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
    turbopack: {
        resolveAlias: {
            "@jongminchung/ui/components/badge":
                "../../packages/ui/dist/components/badge.js",
            "@jongminchung/ui/components/button":
                "../../packages/ui/dist/components/button.js",
            "@jongminchung/ui/components/card":
                "../../packages/ui/dist/components/card.js",
            "@jongminchung/ui/components/command":
                "../../packages/ui/dist/components/command.js",
            "@jongminchung/ui/components/dialog":
                "../../packages/ui/dist/components/dialog.js",
            "@jongminchung/ui/components/input":
                "../../packages/ui/dist/components/input.js",
            "@jongminchung/ui/components/input-group":
                "../../packages/ui/dist/components/input-group.js",
            "@jongminchung/ui/components/sheet":
                "../../packages/ui/dist/components/sheet.js",
            "@jongminchung/ui/components/textarea":
                "../../packages/ui/dist/components/textarea.js",
            "@jongminchung/ui/components/tooltip":
                "../../packages/ui/dist/components/tooltip.js",
            "@jongminchung/ui/lib/utils": "../../packages/ui/dist/lib/utils.js",
        },
    },
} satisfies NextConfig;

export default nextConfig;
