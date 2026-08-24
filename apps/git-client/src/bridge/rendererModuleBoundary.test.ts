import { readdirSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_FILE = /\.(?:ts|tsx)$/u;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx)$/u;
const STATIC_IMPORT =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\sfrom\s*)?["']([^"']+)["']/gmu;
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"']+)["']\s*\)/gmu;
const NODE_MODULES = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/u, "")]),
);

function productionSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)
      ? [path]
      : [];
  });
}

function moduleSpecifiers(source: string): readonly string[] {
  return [
    ...source.matchAll(STATIC_IMPORT),
    ...source.matchAll(DYNAMIC_IMPORT),
  ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

describe("방문자 렌더 모듈러 경계", () => {
  it("[실패] Electron 또는 Node 내장을 가져오지 기능이 없습니다", () => {
    const violations = productionSources(SOURCE_ROOT).flatMap((path) =>
      moduleSpecifiers(readFileSync(path, "utf8")).flatMap((specifier) => {
        const root =
          specifier.replace(/^node:/u, "").split("/")[0] ?? specifier;
        return specifier === "electron" ||
          specifier.startsWith("electron/") ||
          specifier.startsWith("node:") ||
          NODE_MODULES.has(root)
          ? [`${relative(SOURCE_ROOT, path)} -> ${specifier}`]
          : [];
      }),
    );

    expect(violations).toEqual([]);
  });

  it("[실패] 전자 구현 폴더에 의존하지 않음", () => {
    const electronRoot = resolve(SOURCE_ROOT, "../electron");
    const violations = productionSources(SOURCE_ROOT).flatMap((path) =>
      moduleSpecifiers(readFileSync(path, "utf8")).flatMap((specifier) => {
        if (!specifier.startsWith(".")) return [];
        const resolved = resolve(dirname(path), specifier);
        return resolved === electronRoot ||
          resolved.startsWith(`${electronRoot}/`)
          ? [`${relative(SOURCE_ROOT, path)} -> ${specifier}`]
          : [];
      }),
    );

    expect(violations).toEqual([]);
  });

  it("[성공] 유형 어댑터에서 워크벤치 사용자 정의 이벤트를 중앙 집중화함", () => {
    const violations = productionSources(SOURCE_ROOT).flatMap((path) => {
      const sourcePath = relative(SOURCE_ROOT, path);
      if (sourcePath === "adapters/workbench-events/workbenchEvents.ts")
        return [];
      return readFileSync(path, "utf8").includes("new CustomEvent")
        ? [sourcePath]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it("[성공] 수호자 후방 Zustand 내부를 유지함", () => {
    const violations = productionSources(SOURCE_ROOT).flatMap((path) => {
      const sourcePath = relative(SOURCE_ROOT, path);
      return moduleSpecifiers(readFileSync(path, "utf8")).flatMap(
        (specifier) => {
          if (!specifier.includes("/state/slices/")) return [];
          const ownsStoreComposition = sourcePath.includes("/state/");
          return ownsStoreComposition ? [] : [`${sourcePath} -> ${specifier}`];
        },
      );
    });

    expect(violations).toEqual([]);
  });
});
