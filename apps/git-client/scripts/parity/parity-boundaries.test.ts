import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function imports(path: string): readonly string[] {
  const source = readFileSync(path, "utf8");
  const values: string[] = [];
  const staticImport = /(?:import|export)\s+(?:[^"']*?\sfrom\s*)?["']([^"']+)["']/gu;
  const dynamicImport = /import\s*\(\s*["']([^"']+)["']\s*\)/gu;
  for (const pattern of [staticImport, dynamicImport]) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1];
      if (value) values.push(value);
    }
  }
  return values;
}

describe("parity dependency boundaries", () => {
  it("keeps reference verification independent from candidate implementation", () => {
    const referenceModule = resolve(import.meta.dirname, "reference-evidence.mjs");

    expect(imports(referenceModule)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/(?:^|\/)src(?:\/|$)/u)]),
    );
  });

  it("keeps candidate observers independent from reference contracts and comparators", () => {
    const observer = resolve(import.meta.dirname, "../../tests/parity/observers/popup-observer.ts");

    expect(imports(observer)).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/parity\/rebased|parity-result|reference-evidence/u),
      ]),
    );
  });
});
