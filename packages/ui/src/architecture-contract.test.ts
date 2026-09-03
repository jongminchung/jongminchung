import { describe, expect, it } from "bun:test";
import { glob, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(resolve(repositoryRoot, path), "utf8"),
  ) as Record<string, unknown>;
}

async function sourceFiles(pattern: string): Promise<string[]> {
  const files: string[] = [];
  for await (const file of glob(pattern, { cwd: repositoryRoot }))
    files.push(file);
  return files.toSorted();
}

describe("공유 UI architecture 계약", () => {
  it("[성공] shadcn 설정과 생성 위치의 소유권을 유지함", async () => {
    const [consumer, shared] = await Promise.all([
      readJson("apps/web/components.json"),
      readJson("packages/ui/components.json"),
    ]);
    const consumerTailwind = consumer.tailwind as Record<string, unknown>;
    const sharedTailwind = shared.tailwind as Record<string, unknown>;
    const consumerAliases = consumer.aliases as Record<string, unknown>;
    const sharedAliases = shared.aliases as Record<string, unknown>;

    expect({
      style: consumer.style,
      iconLibrary: consumer.iconLibrary,
      baseColor: consumerTailwind.baseColor,
    }).toEqual({
      style: shared.style,
      iconLibrary: shared.iconLibrary,
      baseColor: sharedTailwind.baseColor,
    });
    expect(sharedAliases).toMatchObject({
      components: "#components",
      hooks: "#hooks",
      lib: "#lib",
      ui: "#components",
      utils: "#lib/utils",
    });
    expect(consumerAliases).toMatchObject({
      hooks: "@jongminchung/ui/hooks",
      ui: "@jongminchung/ui/components",
      utils: "@jongminchung/ui/lib/utils",
    });
    expect(
      await sourceFiles("apps/*/{components,src/components}/ui/**/*.{ts,tsx}"),
    ).toEqual([]);
  });

  it("[성공] 앱이 Base UI와 package root를 우회하지 않음", async () => {
    const files = await sourceFiles(
      "apps/*/{app,components,lib,src}/**/*.{ts,tsx}",
    );
    const violations: string[] = [];

    await Promise.all(
      files.map(async (file) => {
        const source = await readFile(resolve(repositoryRoot, file), "utf8");
        if (/from\s+["']@base-ui\/react(?:\/|["'])/u.test(source))
          violations.push(`${file}: direct Base UI import`);
        if (/from\s+["']@jongminchung\/ui["']/u.test(source))
          violations.push(`${file}: package root import`);
      }),
    );

    expect(violations.toSorted()).toEqual([]);
  });

  it("[성공] Tailwind entry와 package export map을 유지함", async () => {
    const cssFiles = await sourceFiles("apps/*/{app,src/app}/**/*.css");
    const entryFiles: string[] = [];
    for (const file of cssFiles) {
      const source = await readFile(resolve(repositoryRoot, file), "utf8");
      if (!source.includes('@import "@jongminchung/ui/globals.css"')) continue;
      entryFiles.push(file);
      expect(source, file).toContain("@source ");
    }
    expect(entryFiles).toEqual([
      "apps/web/app/(home)/home.css",
      "apps/web/app/(invest)/invest.css",
      "apps/web/app/(tech)/tech.css",
    ]);

    const manifest = await readJson("packages/ui/package.json");
    expect(manifest.exports).toEqual({
      "./globals.css": "./src/styles/globals.css",
      "./root.css": "./src/styles/root.css",
      "./theme.css": "./src/styles/theme.css",
      "./tokens.css": "./src/styles/tokens.css",
      "./lib/*": {
        source: "./src/lib/*.ts",
        types: "./dist/lib/*.d.ts",
        import: "./dist/lib/*.js",
      },
      "./components/*": {
        source: "./src/components/*.tsx",
        types: "./dist/components/*.d.ts",
        import: "./dist/components/*.js",
      },
      "./hooks/*": {
        source: "./src/hooks/*.ts",
        types: "./dist/hooks/*.d.ts",
        import: "./dist/hooks/*.js",
      },
      "./package.json": "./package.json",
    });
  });
});
