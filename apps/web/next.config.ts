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
  // 정적 shell과 동적 스트리밍을 함께 사용하고 use cache로 캐시 범위를 명시함.
  cacheComponents: true,
  poweredByHeader: false,
  experimental: {
    // 여러 root layout 바깥에서도 공통 global-not-found 응답을 제공함.
    globalNotFound: true,
    // 프로젝트에 설치된 TS CLI로 빌드 타입 검사와 설정 로딩을 수행함.
    useTypeScriptCli: true,
  },
  // Vercel의 Next.js adapter가 managed output을 구성하며 standalone은 컨테이너 빌드에서만 사용함
  ...(isVercelBuild
    ? {}
    : {
        output: "standalone" as const,
        // 앱 밖의 공유 workspace 파일도 standalone 추적 범위에 포함함.
        outputFileTracingRoot: resolve(appRoot, "../.."),
      }),
  // 컴포넌트·Hook을 자동으로 판별해 메모이제이션함. 기존 use memo 선언도 유지됨.
  // babel-plugin-react-compiler가 필요하며 비호환 함수는 use no memo로 개별 제외할 수 있음.
  reactCompiler: {
    compilationMode: "infer",
  },
  // 개발 중 추가 렌더링·Effect 검사로 순수성 및 cleanup 누락을 드러냄.
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

// MDX 컴파일과 요청별 국제화 설정을 Next 빌드에 연결함.
export default createMDX()(withNextIntl(nextConfig));
