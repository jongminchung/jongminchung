import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import rawCommandManifest from "../../src/command-manifest.json";

const source = readFileSync(
    resolve(fileURLToPath(new URL(".", import.meta.url)), "menu-service.ts"),
    "utf8",
);
const commandHelpers = new Set([
    "command",
    "toggleCommand",
    "radioCommand",
    "acceleratorCommand",
]);

function menuCommandCalls(): readonly ts.CallExpression[] {
    const file = ts.createSourceFile(
        "menu-service.ts",
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const calls: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
            commandHelpers.has(node.expression.name.text)
        ) {
            calls.push(node);
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    return calls;
}

function enclosingMethodName(node: ts.Node): string | undefined {
    let current: ts.Node | undefined = node.parent;
    while (current !== undefined) {
        if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
            return current.name.text;
        }
        current = current.parent;
    }
    return undefined;
}

describe("native menu command contract", () => {
    it("uses only canonical manifest IDs and owns no command copy", () => {
        const calls = menuCommandCalls();
        const ids = calls.flatMap((call) => {
            expect(call.arguments).toHaveLength(1);
            const [argument] = call.arguments;
            if (argument && ts.isStringLiteral(argument)) {
                return [argument.text];
            }

            const helperName = enclosingMethodName(call);
            expect(
                argument !== undefined &&
                    ts.isIdentifier(argument) &&
                    argument.text === "id" &&
                    [
                        "acceleratorCommand",
                        "radioCommand",
                        "toggleCommand",
                    ].includes(helperName ?? ""),
            ).toBe(true);
            return [];
        });
        const manifestIds = new Set(
            rawCommandManifest.commands.map((command) => command.id),
        );

        expect(ids.length).toBeGreaterThan(100);
        expect(ids.every((id) => manifestIds.has(id))).toBe(true);
    });
});
