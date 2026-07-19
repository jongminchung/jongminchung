import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function readText(relativePath: string): string {
    return readFileSync(
        fileURLToPath(
            new URL(relativePath, new URL("../../", import.meta.url)),
        ),
        "utf8",
    );
}

function readReport(name: string): Record<string, unknown> {
    return JSON.parse(
        readText(`parity/rebased/1.1.8/reports/${name}`),
    ) as Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
    expect(value).toBeTypeOf("object");
    expect(value).not.toBeNull();
    expect(Array.isArray(value)).toBe(false);
    return value as Record<string, unknown>;
}

function records(value: unknown): readonly Record<string, unknown>[] {
    expect(Array.isArray(value)).toBe(true);
    return value as readonly Record<string, unknown>[];
}

function gitBridgeMethods(): readonly string[] {
    const source = readText("src/bridge/GitBridge.ts");
    const interfaceStart = source.indexOf("export interface GitBridge {");
    const interfaceEnd = source.indexOf("\n}", interfaceStart);
    expect(interfaceStart).toBeGreaterThanOrEqual(0);
    expect(interfaceEnd).toBeGreaterThan(interfaceStart);
    return [
        ...source
            .slice(interfaceStart, interfaceEnd)
            .matchAll(/^ {4}([A-Za-z][A-Za-z0-9]*)\(/gmu),
    ].map((match) => match[1] ?? "");
}

describe("Electron bridge support report", () => {
    it("accounts for every GitBridge method in source order as connected", () => {
        const report = readReport("electron-bridge-support.json");
        const methods = records(report.methods);
        const contractMethods = gitBridgeMethods();
        expect(contractMethods).toHaveLength(43);
        expect(methods.map((method) => method.method)).toEqual(contractMethods);
        expect(new Set(methods.map((method) => method.method)).size).toBe(43);
        const packageVerifiedMethods = new Set(contractMethods);
        for (const method of methods) {
            expect(method).toMatchObject({
                status: "supported",
                transportConnected: true,
                packageVerification: packageVerifiedMethods.has(
                    String(method.method),
                )
                    ? "passed"
                    : "pending",
                rebasedParity: "unverified",
            });
        }
        expect(record(report.summary)).toEqual({
            contractMethods: 43,
            supported: 43,
            partial: 0,
            unsupported: 0,
            emptyFallback: 0,
            noOp: 0,
            packageVerified: 43,
            rebasedVerified: 0,
            complete: false,
        });
        expect(report.complete).toBe(false);
    });

    it("fails if the production Electron bridge regains an unsupported, empty-fallback, or no-op path", () => {
        const source = readText("src/bridge/ElectronGitBridge.ts");
        expect(source).not.toMatch(
            /UnsupportedElectronGitFeatureError|#unsupported\s*[<(]/u,
        );
        expect(source).not.toMatch(/Promise\.resolve\(\s*\[\s*\]\s*\)/u);
        expect(source).not.toMatch(
            /return\s+Promise\.resolve\(\s*undefined\s*\)/u,
        );
        for (const method of gitBridgeMethods()) {
            expect(source, method).toMatch(
                new RegExp(`\\b${method}\\s*\\(`, "u"),
            );
        }
    });

    it("keeps implementation progress separate from incomplete bidirectional parity coverage", () => {
        const support = readReport("electron-bridge-support.json");
        const coverage = readReport("coverage.json");
        expect(support.complete).toBe(false);
        expect(coverage.complete).toBe(false);
        expect(record(coverage.sourceToRuntime)).toMatchObject({
            status: "in-progress",
            total: 7_260,
            observed: 17,
            resolved: 219,
            coverage: 3.016529,
        });
        expect(record(coverage.runtimeToSource)).toMatchObject({
            status: "in-progress",
            total: 22,
            mapped: 14,
            coverage: 63.636364,
        });
        expect(
            record(coverage.implementationProgress).countsAsParityCoverage,
        ).toBe(false);
        expect(record(coverage.packaging)).toMatchObject({
            electronVersion: "43.1.1",
            rebuiltPackage: "passed",
            packageE2e: "passed-12-of-12",
            localAdHocDmg: "passed-byte-reproducible",
            artifactSha256:
                "05f241b616b57351f88e260c382759e7d995112e2f1b0a765de80e0c79b883d5",
            developerId: "blocked-no-identity",
            notarization: "blocked-no-credentials",
        });
    });

    it("only cites evidence files that exist", () => {
        const report = readReport("electron-bridge-support.json");
        for (const evidence of records(report.evidence)) {
            const relativePath = String(evidence.file);
            expect(
                statSync(`${APP_ROOT}${relativePath}`).isFile(),
                relativePath,
            ).toBe(true);
        }
    });
});
