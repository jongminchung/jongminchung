import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import ts from "typescript";

export const workspaceRoot = resolve(import.meta.dirname, "../..");

const sourceExtensions = new Set([".mjs", ".ts", ".tsx"]);
const excludedDirectories = new Set([
    ".git",
    ".next",
    ".output",
    ".vite",
    "coverage",
    "dist",
    "generated",
    "node_modules",
    "out",
    "release-artifacts",
    "target",
    "test-results",
]);
const testFilePattern = /\.(?:e2e|integration|spec|test)\.[^.]+$/u;

export function workspacePath(filePath: string): string {
    return relative(workspaceRoot, filePath).split(sep).join("/");
}

export function sourceFiles(directory: string): readonly string[] {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isDirectory() && excludedDirectories.has(entry.name))
            return [];
        const entryPath = resolve(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(entryPath);
        return sourceExtensions.has(extname(entry.name)) ? [entryPath] : [];
    });
}

export function productionSourceFiles(directory: string): readonly string[] {
    return sourceFiles(directory).filter(
        (filePath) => !testFilePattern.test(filePath),
    );
}

export function importSpecifiers(filePath: string): readonly string[] {
    const sourceFile = parseSourceFile(filePath);
    const specifiers: string[] = [];
    const visit = (node: ts.Node): void => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier !== undefined &&
            ts.isStringLiteralLike(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text);
        } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference) &&
            node.moduleReference.expression !== undefined &&
            ts.isStringLiteralLike(node.moduleReference.expression)
        ) {
            specifiers.push(node.moduleReference.expression.text);
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteralLike(node.argument.literal)
        ) {
            specifiers.push(node.argument.literal.text);
        } else if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (node.arguments.length === 1 &&
                    ts.isIdentifier(node.expression) &&
                    node.expression.text === "require"))
        ) {
            const argument = node.arguments[0];
            if (argument !== undefined && ts.isStringLiteralLike(argument))
                specifiers.push(argument.text);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return specifiers;
}

export function parseSourceFile(filePath: string): ts.SourceFile {
    return ts.createSourceFile(
        filePath,
        readFileSync(filePath, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
}

export function identifierLocations(
    filePath: string,
    identifier: string,
): readonly string[] {
    const sourceFile = parseSourceFile(filePath);
    const locations: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node) && node.text === identifier) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
                node.getStart(sourceFile),
            );
            locations.push(`${workspacePath(filePath)}:${line + 1}`);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return locations;
}

export function jsxLocations(filePath: string): readonly string[] {
    const sourceFile = parseSourceFile(filePath);
    const locations: string[] = [];
    const visit = (node: ts.Node): void => {
        if (
            ts.isJsxElement(node) ||
            ts.isJsxSelfClosingElement(node) ||
            ts.isJsxFragment(node)
        ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
                node.getStart(sourceFile),
            );
            locations.push(`${workspacePath(filePath)}:${line + 1}`);
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return locations;
}

export function resolveSpecifier(
    importer: string,
    specifier: string,
): string | null {
    if (!specifier.startsWith(".")) return null;
    return resolve(dirname(importer), specifier);
}
