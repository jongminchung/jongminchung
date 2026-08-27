import { resolve } from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const appRoot = import.meta.dirname;
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const isVercelBuild = process.env.VERCEL === "1";

const nextConfig = {
  cacheComponents: true,
  experimental: {
    globalNotFound: true,
  },
  // Vercel의 Next.js adapter가 managed output을 구성하며 standalone은 컨테이너 빌드에서만 사용함
  ...(isVercelBuild
    ? {}
    : {
        output: "standalone" as const,
        outputFileTracingRoot: resolve(appRoot, "../.."),
      }),
  reactCompiler: {
    compilationMode: "annotation",
  },
  reactStrictMode: true,
  // UI를 source-first로 transpile해 dev·typecheck·build가 같은 module graph를 사용함
  transpilePackages: ["@jongminchung/ui"],
} satisfies NextConfig;

export default createMDX()(withNextIntl(nextConfig));
