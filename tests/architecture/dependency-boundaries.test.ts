import { resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";
import {
    importSpecifiers,
    productionSourceFiles,
    resolveSpecifier,
    sourceFiles,
    workspacePath,
    workspaceRoot,
} from "./source-files";

function violations(
    files: readonly string[],
    rejects: (filePath: string, specifier: string) => boolean,
): readonly string[] {
    return files.flatMap((filePath) =>
        importSpecifiers(filePath).flatMap((specifier) =>
            rejects(filePath, specifier)
                ? [`${workspacePath(filePath)} -> ${specifier}`]
                : [],
        ),
    );
}

describe("workspace dependency boundaries", () => {
    test("keeps packages independent from applications", () => {
        const appsRoot = `${resolve(workspaceRoot, "apps")}${sep}`;
        const result = violations(
            productionSourceFiles(resolve(workspaceRoot, "packages")),
            (filePath, specifier) => {
                const target = resolveSpecifier(filePath, specifier);
                return (
                    specifier.startsWith("apps/") ||
                    (target !== null && target.startsWith(appsRoot))
                );
            },
        );
        expect(result).toEqual([]);
    });

    test("requires applications to use package exports", () => {
        const packagesRoot = `${resolve(workspaceRoot, "packages")}${sep}`;
        const result = violations(
            productionSourceFiles(resolve(workspaceRoot, "apps")),
            (filePath, specifier) => {
                const target = resolveSpecifier(filePath, specifier);
                return (
                    /@jongminchung\/[^/]+\/src(?:\/|$)/u.test(specifier) ||
                    (target !== null &&
                        target.startsWith(packagesRoot) &&
                        target.includes(`${sep}src${sep}`))
                );
            },
        );
        expect(result).toEqual([]);
    });

    test("keeps the Git renderer independent from Electron implementation files", () => {
        const electronRoot = `${resolve(
            workspaceRoot,
            "apps/git-client/electron",
        )}${sep}`;
        const result = violations(
            productionSourceFiles(
                resolve(workspaceRoot, "apps/git-client/src"),
            ),
            (filePath, specifier) => {
                const target = resolveSpecifier(filePath, specifier);
                return target !== null && target.startsWith(electronRoot);
            },
        );
        expect(result).toEqual([]);
    });

    test("keeps shared contracts free of React and outer application layers", () => {
        const contractsRoot = resolve(
            workspaceRoot,
            "apps/git-client/src/shared/contracts",
        );
        const forbiddenSegments = [
            `${sep}adapters${sep}`,
            `${sep}app${sep}`,
            `${sep}features${sep}`,
            `${sep}electron${sep}`,
        ];
        const result = violations(
            sourceFiles(contractsRoot),
            (filePath, specifier) => {
                if (specifier === "react" || specifier.startsWith("react/"))
                    return true;
                const target = resolveSpecifier(filePath, specifier);
                return (
                    target !== null &&
                    forbiddenSegments.some((segment) =>
                        target.includes(segment),
                    )
                );
            },
        );
        expect(result).toEqual([]);
    });
});
