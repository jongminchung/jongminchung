import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";
import {
    identifierLocations,
    importSpecifiers,
    jsxLocations,
    productionSourceFiles,
    resolveSpecifier,
    sourceFiles,
    workspacePath,
    workspaceRoot,
} from "./source-files";

const gitClientSourceRoot = resolve(workspaceRoot, "apps/git-client/src");
const applicationRoot = resolve(gitClientSourceRoot, "application");
const adaptersRoot = resolve(gitClientSourceRoot, "adapters");
const appRoot = resolve(gitClientSourceRoot, "app");
const domainRoot = resolve(gitClientSourceRoot, "domain");
const featuresRoot = resolve(gitClientSourceRoot, "features");
const bridgeRoot = resolve(gitClientSourceRoot, "bridge");
const platformRoot = resolve(gitClientSourceRoot, "platform");
const legacyGitSessionRoot = resolve(gitClientSourceRoot, "git-session");
const rendererBootstrap = resolve(gitClientSourceRoot, "main.tsx");
const workbenchEventAdapter = resolve(
    adaptersRoot,
    "workbench-events/workbenchEvents.ts",
);

function isInside(directory: string, filePath: string): boolean {
    return filePath === directory || filePath.startsWith(`${directory}${sep}`);
}

function sourceLayer(filePath: string): string | null {
    if (!isInside(gitClientSourceRoot, filePath)) return null;
    const [layer] = relative(gitClientSourceRoot, filePath).split(sep);
    return layer ?? null;
}

function localImportViolations(
    files: readonly string[],
    allowedLayers: ReadonlySet<string>,
): readonly string[] {
    return files.flatMap((filePath) =>
        importSpecifiers(filePath).flatMap((specifier) => {
            const target = resolveSpecifier(filePath, specifier);
            if (target === null)
                return specifier.startsWith("#")
                    ? [
                          `${workspacePath(filePath)} -> ${specifier} (package import alias)`,
                      ]
                    : [];
            const layer = sourceLayer(target);
            return layer !== null && allowedLayers.has(layer)
                ? []
                : [
                      `${workspacePath(filePath)} -> ${specifier} (${layer ?? "outside src"})`,
                  ];
        }),
    );
}

function lineCount(filePath: string): number {
    const contents = readFileSync(filePath, "utf8");
    return contents.length === 0 ? 0 : contents.split(/\r?\n/u).length;
}

describe("Git Client layer ownership", () => {
    test("does not restore the legacy top-level Git session layer", () => {
        expect(existsSync(legacyGitSessionRoot)).toBe(false);
    });

    test("keeps features on inward contracts and shared presentation components", () => {
        expect(
            localImportViolations(
                productionSourceFiles(featuresRoot),
                new Set([
                    "application",
                    "components",
                    "domain",
                    "features",
                    "shared",
                ]),
            ),
        ).toEqual([]);
    });

    test("keeps application inward-facing and independent from React", () => {
        const files = productionSourceFiles(applicationRoot);
        const dependencyViolations = localImportViolations(
            files,
            new Set(["application", "domain", "shared"]),
        );
        const reactImportViolations = files.flatMap((filePath) =>
            importSpecifiers(filePath).flatMap((specifier) =>
                specifier === "react" ||
                specifier.startsWith("react/") ||
                specifier === "react-dom" ||
                specifier.startsWith("react-dom/")
                    ? [`${workspacePath(filePath)} -> ${specifier}`]
                    : [],
            ),
        );
        const reactSyntaxViolations = files.flatMap(jsxLocations);

        expect([
            ...dependencyViolations,
            ...reactImportViolations,
            ...reactSyntaxViolations.map(
                (location) => `${location} -> JSX syntax`,
            ),
        ]).toEqual([]);
    });

    test("routes feature and application infrastructure through ports", () => {
        const violations = [featuresRoot, applicationRoot].flatMap((root) =>
            productionSourceFiles(root).flatMap((filePath) =>
                importSpecifiers(filePath).flatMap((specifier) => {
                    const target = resolveSpecifier(filePath, specifier);
                    return target !== null &&
                        (isInside(bridgeRoot, target) ||
                            isInside(platformRoot, target))
                        ? [`${workspacePath(filePath)} -> ${specifier}`]
                        : [];
                }),
            ),
        );

        expect(violations).toEqual([]);
    });

    test("keeps domain pure and independent from outer layers and React", () => {
        const files = productionSourceFiles(domainRoot);
        const commandManifest = resolve(
            gitClientSourceRoot,
            "command-manifest.json",
        );
        const dependencyViolations = files.flatMap((filePath) =>
            importSpecifiers(filePath).flatMap((specifier) => {
                const target = resolveSpecifier(filePath, specifier);
                if (target === null)
                    return [`${workspacePath(filePath)} -> ${specifier}`];
                if (target === commandManifest) return [];
                const layer = sourceLayer(target);
                return layer === "domain" || layer === "shared"
                    ? []
                    : [
                          `${workspacePath(filePath)} -> ${specifier} (${layer ?? "outside src"})`,
                      ];
            }),
        );
        const reactImportViolations = files.flatMap((filePath) =>
            importSpecifiers(filePath).flatMap((specifier) =>
                specifier === "react" ||
                specifier.startsWith("react/") ||
                specifier === "react-dom" ||
                specifier.startsWith("react-dom/")
                    ? [`${workspacePath(filePath)} -> ${specifier}`]
                    : [],
            ),
        );
        const reactSyntaxViolations = files.flatMap(jsxLocations);

        expect([
            ...dependencyViolations,
            ...reactImportViolations,
            ...reactSyntaxViolations.map(
                (location) => `${location} -> JSX syntax`,
            ),
        ]).toEqual([]);
    });

    test("lets only app composition, renderer bootstrap, and adapters depend on adapters", () => {
        const violations = productionSourceFiles(gitClientSourceRoot).flatMap(
            (filePath) => {
                const importerLayer = sourceLayer(filePath);
                if (
                    importerLayer === "app" ||
                    importerLayer === "adapters" ||
                    filePath === rendererBootstrap
                )
                    return [];
                return importSpecifiers(filePath).flatMap((specifier) => {
                    const target = resolveSpecifier(filePath, specifier);
                    return target !== null && isInside(adaptersRoot, target)
                        ? [`${workspacePath(filePath)} -> ${specifier}`]
                        : [];
                });
            },
        );

        expect(violations).toEqual([]);
    });

    test("keeps adapters directed toward contracts and renderer infrastructure", () => {
        expect(
            localImportViolations(
                productionSourceFiles(adaptersRoot),
                new Set([
                    "adapters",
                    "application",
                    "bridge",
                    "domain",
                    "platform",
                    "shared",
                ]),
            ),
        ).toEqual([]);
    });

    test("keeps RepositoryWorkspace composition small and removes legacy command context", () => {
        const compositionPath = resolve(
            appRoot,
            "composition/RepositoryWorkspaceComposition.tsx",
        );
        expect(existsSync(compositionPath)).toBe(true);

        const files = sourceFiles(gitClientSourceRoot);
        const facadeFiles = files.filter((filePath) =>
            new Set([
                "RepositoryWorkspace.tsx",
                "RepositoryWorkspaceComposition.tsx",
            ]).has(basename(filePath)),
        );
        const oversizedFacades = facadeFiles.flatMap((filePath) => {
            const lines = lineCount(filePath);
            return lines <= 350
                ? []
                : [`${workspacePath(filePath)}: ${lines} lines`];
        });
        const contextViolations = files.flatMap((filePath) =>
            identifierLocations(filePath, "RepositoryCommandContext"),
        );
        const legacyTypeFiles = files
            .filter((filePath) =>
                basename(filePath).startsWith("repositoryCommandTypes."),
            )
            .map(workspacePath);
        const legacyTypeImports = files.flatMap((filePath) =>
            importSpecifiers(filePath).flatMap((specifier) =>
                /(?:^|\/)repositoryCommandTypes$/u.test(specifier)
                    ? [`${workspacePath(filePath)} -> ${specifier}`]
                    : [],
            ),
        );

        expect([
            ...oversizedFacades,
            ...contextViolations,
            ...legacyTypeFiles,
            ...legacyTypeImports,
        ]).toEqual([]);
    });

    test("contains raw CustomEvent usage in the typed workbench adapter", () => {
        const violations = productionSourceFiles(gitClientSourceRoot).flatMap(
            (filePath) =>
                filePath === workbenchEventAdapter
                    ? []
                    : identifierLocations(filePath, "CustomEvent"),
        );

        expect(violations).toEqual([]);
    });
});
