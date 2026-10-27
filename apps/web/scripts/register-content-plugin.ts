import { registerHooks } from "node:module";
import { register } from "fumadocs-mdx/node";

// 콘텐츠 CLI에서만 서버 전용 표시자를 빈 모듈로 해석한다.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        url: "data:text/javascript,export%20%7B%7D",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
register();
