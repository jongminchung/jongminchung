import { describe, expect, it } from "bun:test";
import nextConfig from "./next.config.ts";

describe("Next.js framework configuration", () => {
  it("preserves framework policies after MDX and i18n plugin composition", async () => {
    const config = await nextConfig;

    expect(config.reactCompiler).toMatchObject({
      compilationMode: "annotation",
    });
    expect(config.experimental?.useTypeScriptCli).toBe(true);
    expect(config.cacheComponents).toBe(true);
    expect(config.transpilePackages).toContain("@jongminchung/ui");
  });
});
