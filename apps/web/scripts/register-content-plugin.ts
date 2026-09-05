import { plugin } from "bun";
import { createMdxPlugin } from "fumadocs-mdx/bun";

// 이 preload는 서버에서 실행하는 Bun 테스트·콘텐츠 CLI에만 사용한다.
// Next 빌드는 이 파일을 로드하지 않으므로 client의 server-only import를 계속 거부한다.
plugin({
  name: "bun-server-only",
  setup(build) {
    build.module("server-only", () => ({
      exports: {},
      loader: "object",
    }));
  },
});

await plugin(createMdxPlugin());
