import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(resolve(repositoryRoot, path), "utf8");
}

describe("React 19.2 adoption contract", () => {
  it("keeps the compiler opt-in in the Web application", async () => {
    const [nextConfig, webLeaf] = await Promise.all([
      readRepositoryFile("apps/web/next.config.ts"),
      readRepositoryFile("apps/web/components/BrandWordmark.tsx"),
    ]);

    expect(nextConfig).toContain('compilationMode: "annotation"');
    expect(webLeaf).toContain('"use memo"');
  });

  it("keeps Cache Components enabled without legacy route config", async () => {
    const nextConfig = await readRepositoryFile("apps/web/next.config.ts");
    expect(nextConfig).toContain("cacheComponents: true");

    const routeSources = await Promise.all(
      [
        "apps/web/app/(invest)/invest/[locale]/page.tsx",
        "apps/web/app/(invest)/invest/[locale]/notes/page.tsx",
        "apps/web/app/(tech)/tech/[locale]/(blog)/page.tsx",
        "apps/web/app/(tech)/tech/[locale]/(blog)/[slug]/page.tsx",
        "apps/web/app/(tech)/tech/[locale]/docs/[[...slug]]/page.tsx",
        "apps/web/app/(tech)/tech/[locale]/search/route.ts",
      ].map(readRepositoryFile),
    );
    for (const source of routeSources) {
      expect(source).not.toMatch(
        /export const (?:dynamic|dynamicParams|fetchCache|revalidate|runtime)/u,
      );
    }
  });
});
