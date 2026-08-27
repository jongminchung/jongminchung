import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

async function readRepositoryFile(path: string): Promise<string> {
  return readFile(resolve(repositoryRoot, path), "utf8");
}

describe("React 19.2 adoption contract", () => {
  it("keeps compiler pilots opt-in in both applications", async () => {
    const [viteConfig, nextConfig, gitClientLeaf, webLeaf] = await Promise.all([
      readRepositoryFile("apps/git-client/vite.config.ts"),
      readRepositoryFile("apps/web/next.config.ts"),
      readRepositoryFile("apps/git-client/src/components/Notice.tsx"),
      readRepositoryFile("apps/web/components/BrandWordmark.tsx"),
    ]);

    expect(viteConfig).toContain('compilationMode: "annotation"');
    expect(nextConfig).toContain('compilationMode: "annotation"');
    expect(gitClientLeaf).toContain('"use memo"');
    expect(webLeaf).toContain('"use memo"');
  });

  it("uses Effect Events for long-lived workbench subscriptions", async () => {
    const [toolWindows, bottomPanel] = await Promise.all([
      readRepositoryFile(
        "apps/git-client/src/features/repository/tool-windows/useRepositoryToolWindowController.ts",
      ),
      readRepositoryFile(
        "apps/git-client/src/components/bottom-panel/useBottomPanelLifecycle.ts",
      ),
    ]);

    expect(toolWindows).toContain("useEffectEvent");
    expect(toolWindows).toContain("captureToolWindowLayout");
    expect(bottomPanel).toContain("useEffectEvent");
    expect(bottomPanel).toContain("openPanelTab");
  });

  it("keeps Cache Components enabled without legacy route config", async () => {
    const nextConfig = await readRepositoryFile("apps/web/next.config.ts");
    expect(nextConfig).toContain("cacheComponents: true");

    const routeSources = await Promise.all(
      [
        "apps/web/app/(invest)/invest/[locale]/page.tsx",
        "apps/web/app/(invest)/invest/[locale]/notes/page.tsx",
        "apps/web/app/(tech)/tech/[locale]/[[...slug]]/page.tsx",
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
