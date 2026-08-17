import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import type { MaterialComponentProps } from "#components/materials/types";

interface ManifestEntry {
    readonly id: string;
    readonly name: string;
    readonly renderer: "svg-motion" | "dom-motion" | "canvas";
    readonly topic: string;
}

const appRoot = resolve(import.meta.dirname, "..");

type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;
type ComponentWithUnexpectedRequiredProp = ComponentType<
    MaterialComponentProps & { readonly unexpectedRequiredProp: string }
>;
const rejectsUnexpectedRequiredProps: IsAssignable<
    ComponentWithUnexpectedRequiredProp,
    ComponentType<MaterialComponentProps>
> = false;

async function readManifest(): Promise<readonly ManifestEntry[]> {
    return JSON.parse(
        await readFile(
            resolve(appRoot, "generated/materials-manifest.json"),
            "utf8",
        ),
    ) as readonly ManifestEntry[];
}

async function readLocalizedMaterialIds(
    locale: "ko" | "en",
): Promise<readonly string[]> {
    const directory = resolve(appRoot, `content/tech/${locale}/deep-dive`);
    const fileNames = (await readdir(directory))
        .filter((fileName) => fileName.endsWith(".mdx"))
        .sort();
    const sources = await Promise.all(
        fileNames.map((fileName) =>
            readFile(resolve(directory, fileName), "utf8"),
        ),
    );
    return sources.flatMap((source) =>
        [...source.matchAll(/<MaterialDemo\s+id="([^"]+)"\s*\/>/gu)].map(
            (match) => match[1] ?? "",
        ),
    );
}

describe("재료등록", () => {
    it("[성공] 11개의 주제와 31개의 고유한 스탬프가 포함되어 있음", async () => {
        const manifest = await readManifest();
        expect(manifest).toHaveLength(31);
        expect(new Set(manifest.map((entry) => entry.id)).size).toBe(31);
        expect(new Set(manifest.map((entry) => entry.topic)).size).toBe(11);
    });

    it("[성공] 기본적으로 확장을 측정한 문자열로 제한함", async () => {
        const manifest = await readManifest();
        expect(
            manifest
                .filter((entry) => entry.renderer === "canvas")
                .map((entry) => entry.id)
                .sort(),
        ).toEqual(["the-expensive-main-thread/DynamicPriorityDemo"]);
    });

    it("[성공] 정적 매니페스트 유형 계약에 생성된 모든 항목을 유지함", async () => {
        const registry = await readFile(
            resolve(appRoot, "generated/materials-registry.tsx"),
            "utf8",
        );

        expect(
            registry.match(/satisfies MaterialManifestEntry/gu),
        ).toHaveLength(31);
        expect(registry).not.toContain("as unknown as");
        expect(registry).not.toMatch(
            /\.then\(\s*\(module\)\s*=>\s*module\s*\[/u,
        );
        expect(
            registry.match(
                /\.then\(\s*\(module\)\s*=>\s*module\.[A-Za-z_$][A-Za-z0-9_$]*\s*\)/gu,
            ),
        ).toHaveLength(31);
        expect(rejectsUnexpectedRequiredProps).toBe(false);
    });

    it("[성공] 두 로케일 ID set 모두 고유하고, 정확히 동일하게 유지함", async () => {
        const manifest = await readManifest();
        const expected = manifest.map((entry) => entry.id).sort();

        for (const locale of ["ko", "en"] as const) {
            const ids = [...(await readLocalizedMaterialIds(locale))].sort();
            expect(ids).toHaveLength(31);
            expect(new Set(ids).size).toBe(ids.length);
            expect(ids).toEqual(expected);
        }
    });
});
