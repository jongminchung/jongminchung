import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

interface FontAssetBudget {
  readonly schemaVersion: number;
  readonly pretendardVersion: string;
  readonly pretendardStd: Readonly<{
    path: string;
    bytes: number;
    sha256Base64: string;
  }>;
  readonly pretendardLatin: Readonly<{
    path: string;
    bytes: number;
    sha256Base64: string;
  }>;
  readonly pretendardDynamicSubset: Readonly<{
    stylesheet: Readonly<{
      path: string;
      bytes: number;
      sha256Base64: string;
    }>;
    directory: string;
    files: number;
    bytes: number;
    aggregateSha256Base64: string;
  }>;
}

const webRoot = resolve(import.meta.dirname, "..");
const budget = JSON.parse(
  await readFile(resolve(webRoot, "font-assets.json"), "utf8"),
) as FontAssetBudget;

function sha256Base64(value: Buffer): string {
  return createHash("sha256").update(value).digest("base64");
}

describe("Pretendard asset integrity", () => {
  it("[성공] 영문 subset의 크기와 무결성을 유지함", async () => {
    const source = await readFile(
      resolve(webRoot, budget.pretendardLatin.path),
    );

    expect(source.byteLength).toBe(budget.pretendardLatin.bytes);
    expect(source.byteLength).toBeLessThanOrEqual(45_000);
    expect(sha256Base64(source)).toBe(budget.pretendardLatin.sha256Base64);
  });

  it("[성공] 공식 Pretendard Std variable source를 유지함", async () => {
    const path = resolve(webRoot, budget.pretendardStd.path);
    const source = await readFile(path);

    expect(source.byteLength).toBe(budget.pretendardStd.bytes);
    expect(sha256Base64(source)).toBe(budget.pretendardStd.sha256Base64);
  });

  it("[성공] 공식 한국어 dynamic subset inventory를 유지함", async () => {
    const stylesheet = await readFile(
      resolve(webRoot, budget.pretendardDynamicSubset.stylesheet.path),
    );
    const directory = resolve(
      webRoot,
      budget.pretendardDynamicSubset.directory,
    );
    const filenames = (await readdir(directory))
      .filter((filename) => filename.endsWith(".woff2"))
      .toSorted();
    const sources = await Promise.all(
      filenames.map((filename) => readFile(resolve(directory, filename))),
    );
    const bytes = (
      await Promise.all(
        filenames.map((filename) => stat(resolve(directory, filename))),
      )
    ).reduce((sum, file) => sum + file.size, 0);
    const aggregate = createHash("sha256");
    for (const source of sources) aggregate.update(source);

    expect(budget.schemaVersion).toBe(1);
    expect(budget.pretendardVersion).toBe("1.3.9");
    expect(stylesheet.byteLength).toBe(
      budget.pretendardDynamicSubset.stylesheet.bytes,
    );
    expect(sha256Base64(stylesheet)).toBe(
      budget.pretendardDynamicSubset.stylesheet.sha256Base64,
    );
    expect(filenames).toHaveLength(budget.pretendardDynamicSubset.files);
    expect(bytes).toBe(budget.pretendardDynamicSubset.bytes);
    expect(aggregate.digest("base64")).toBe(
      budget.pretendardDynamicSubset.aggregateSha256Base64,
    );
  });
});
