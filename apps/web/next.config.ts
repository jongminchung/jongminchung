import { realpathSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

function restoreSystemNodeForBuildWorkers(): void {
  if (typeof Bun === "undefined" || process.env.PATH === undefined) return;
  const nodeExecutable = Bun.which("node");
  if (
    nodeExecutable === null ||
    realpathSync(nodeExecutable) !== realpathSync(process.execPath)
  )
    return;
  const bunNodeShimDirectory = resolve(dirname(nodeExecutable));
  process.env.PATH = process.env.PATH.split(delimiter)
    .filter((entry) => resolve(entry) !== bunNodeShimDirectory)
    .join(delimiter);
}

// `--bun`으로 Next 본체를 실행하되 Turbopack의 Node loader worker는 실제 Node IPC를 사용함
restoreSystemNodeForBuildWorkers();

const appRoot = import.meta.dirname;
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const isVercelBuild = process.env.VERCEL === "1";
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
] as const;

const nextConfig = {
  cacheComponents: true,
  experimental: {
    globalNotFound: true,
    useTypeScriptCli: true,
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
  async headers() {
    return [{ source: "/(.*)", headers: [...securityHeaders] }];
  },
  async redirects() {
    return [
      {
        source: "/tech/articles/:id.light.png",
        destination: "/tech/articles/:id.png",
        permanent: true,
      },
      {
        source: "/tech/articles/:id.dark.png",
        destination: "/tech/articles/:id.png",
        permanent: true,
      },
      {
        source: "/invest/:id.light.png",
        destination: "/invest/:id.png",
        permanent: true,
      },
      {
        source: "/invest/:id.dark.png",
        destination: "/invest/:id.png",
        permanent: true,
      },
    ];
  },
  // UI를 source-first로 transpile해 dev·typecheck·build가 같은 module graph를 사용함
  transpilePackages: ["@jongminchung/ui"],
} satisfies NextConfig;

export default createMDX()(withNextIntl(nextConfig));
