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
    const directory = resolve(appRoot, `content/${locale}/deep-dive`);
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

describe("material registry", () => {
    it("contains 11 topics and 31 unique independent demos", async () => {
        const manifest = await readManifest();
        expect(manifest).toHaveLength(31);
        expect(new Set(manifest.map((entry) => entry.id)).size).toBe(31);
        expect(new Set(manifest.map((entry) => entry.topic)).size).toBe(11);
    });

    it("limits native rendering to the measured pixel exception", async () => {
        const manifest = await readManifest();
        expect(
            manifest
                .filter((entry) => entry.renderer === "canvas")
                .map((entry) => entry.id)
                .sort(),
        ).toEqual(["the-expensive-main-thread/DynamicPriorityDemo"]);
    });

    it("keeps every generated entry on the static manifest type contract", async () => {
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

    it("keeps both locale ID sets unique and exactly equal to the registry", async () => {
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
