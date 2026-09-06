import { expect, test } from "bun:test";
import { blogCollection, docsCollection } from "../.source/server";
import { GET as techRss } from "../app/(tech)/tech/[locale]/rss.xml/route";
import techSitemap from "../app/(tech)/tech/sitemap";
import { searchTechDocuments } from "./tech/search-server";

test("all copied MDX recompiles with the production compiler runtime", async () => {
  const result = Bun.spawn(["node", "scripts/verify-reading-roundtrip.ts"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    result.exited,
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
  ]);
  expect(code, stderr).toBe(0);
  expect(stdout).toContain(
    "Verified all 16 MDX source exports and recompilations.",
  );
});

for (const locale of ["ko", "en"] as const) {
  test(`${locale} samples stay outside public content indexes`, async () => {
    const paths = [...blogCollection, ...docsCollection.docs].map(
      (entry) => entry.info.fullPath,
    );
    expect(paths.some((path) => path.includes("fixtures/reading"))).toBe(false);
    const urls = (await techSitemap()).map((entry) => entry.url);
    expect(
      urls.filter((url) => url.endsWith(`/${locale}/showcase`)),
    ).toHaveLength(1);
    expect(
      urls.some((url) => url.includes("/fixtures/") || url.includes("#mdx")),
    ).toBe(false);
    const rss = await techRss(
      new Request(`https://tech.jamie.kr/${locale}/rss.xml`),
      {
        params: Promise.resolve({ locale }),
      },
    );
    const xml = await rss.text();
    expect(xml).not.toContain("/fixtures/");
    expect(xml).not.toContain("#mdx");
    const results = await searchTechDocuments(
      `showcase-${locale}-glossary-idempotency`,
      locale,
    );
    expect(results).toHaveLength(0);
  });
}
