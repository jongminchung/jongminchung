#!/usr/bin/env node
// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.

import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
    FuseState,
    FuseV1Options,
    FuseVersion,
    getCurrentFuseWire,
} from "@electron/fuses";
import {
    packagedElectronFrameworkResourcesPath,
    verifyElectronLocales,
} from "./electron-package-policy.ts";
import { resolvePackagedAppPath } from "./packaged-app-path.ts";

const execFileAsync = promisify(execFile);
const EXPECTED_BUNDLE_ID = "io.github.jongminchung.gitclient";
const EXPECTED_ELECTRON_VERSION = "43.3.0";
const EXPECTED_ARCHITECTURES = "arm64";
const MAX_APP_SIZE_KIB = 250 * 1024;

export interface ElectronPackageVerification {
    readonly appPath: string;
    readonly bundleId: string;
    readonly electronVersion: string;
    readonly architectures: string;
    readonly localeCount: number;
    readonly locales: readonly string[];
    readonly sizeKiB: number;
    readonly sizeMiB: number;
    readonly asarHash: string;
    readonly codesign: string;
    readonly terminalRuntime: Readonly<{
        readonly architecture: string;
        readonly spawnHelperExecutable: boolean;
    }>;
    readonly fuses: Readonly<Record<string, boolean>>;
}

const expectedFuses = new Map([
    [FuseV1Options.RunAsNode, FuseState.DISABLE],
    [FuseV1Options.EnableCookieEncryption, FuseState.ENABLE],
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
    [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
    [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.DISABLE],
    [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE],
    [FuseV1Options.WasmTrapHandlers, FuseState.ENABLE],
]);

function trimOutput(result: any) {
    return result.stdout.trim();
}

async function plistValue(plistPath: any, key: any) {
    return trimOutput(
        await execFileAsync("/usr/bin/plutil", [
            "-extract",
            key,
            "raw",
            "-o",
            "-",
            plistPath,
        ]),
    );
}

async function architectures(binaryPath: any) {
    return trimOutput(
        await execFileAsync("/usr/bin/lipo", ["-archs", binaryPath]),
    );
}

async function appSizeKiB(appPath: any) {
    const output = trimOutput(
        await execFileAsync("/usr/bin/du", ["-sk", appPath]),
    );
    const [sizeText] = output.split(/\s+/, 1);
    const size = Number.parseInt(sizeText, 10);
    if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error(`Could not parse packaged app size: ${output}`);
    }
    return size;
}

async function verifyAsarIntegrity(infoPlistPath: any) {
    const output = trimOutput(
        await execFileAsync("/usr/bin/plutil", [
            "-extract",
            "ElectronAsarIntegrity",
            "json",
            "-o",
            "-",
            infoPlistPath,
        ]),
    );
    const integrity = JSON.parse(output);
    const appAsar = integrity["Resources/app.asar"];
    if (
        appAsar?.algorithm !== "SHA256" ||
        typeof appAsar.hash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(appAsar.hash)
    ) {
        throw new Error(
            "Packaged app is missing valid SHA-256 ASAR integrity metadata",
        );
    }
    return appAsar.hash;
}

function verifyFuses(fuses: any) {
    if (fuses.version !== FuseVersion.V1) {
        throw new Error(`Expected fuse wire V1, received ${fuses.version}`);
    }
    for (const [fuse, expected] of expectedFuses) {
        const actual = fuses[fuse];
        if (actual !== expected) {
            throw new Error(
                `Unexpected ${FuseV1Options[fuse]} fuse: expected ${expected}, received ${String(actual)}`,
            );
        }
    }
}

async function verifyTerminalRuntime(appPath: any) {
    const runtimeRoot = join(
        appPath,
        "Contents",
        "Resources",
        "node-pty",
        "prebuilds",
        "darwin-arm64",
    );
    const ptyModule = join(runtimeRoot, "pty.node");
    const spawnHelper = join(runtimeRoot, "spawn-helper");
    const [ptyStat, helperStat] = await Promise.all([
        lstat(ptyModule),
        lstat(spawnHelper),
    ]);
    if (!ptyStat.isFile() || ptyStat.isSymbolicLink()) {
        throw new Error("Packaged node-pty module must be a regular file");
    }
    if (!helperStat.isFile() || helperStat.isSymbolicLink()) {
        throw new Error(
            "Packaged node-pty spawn-helper must be a regular file",
        );
    }
    if ((helperStat.mode & 0o111) === 0) {
        throw new Error("Packaged node-pty spawn-helper is not executable");
    }
    const [ptyArchitectures, helperArchitectures] = await Promise.all([
        architectures(ptyModule),
        architectures(spawnHelper),
    ]);
    if (
        ptyArchitectures !== EXPECTED_ARCHITECTURES ||
        helperArchitectures !== EXPECTED_ARCHITECTURES
    ) {
        throw new Error(
            `Expected ARM64 node-pty runtime, received module=${ptyArchitectures}, helper=${helperArchitectures}`,
        );
    }
    return Object.freeze({
        architecture: EXPECTED_ARCHITECTURES,
        spawnHelperExecutable: true,
    });
}

export async function verifyElectronPackage(
    inputPath: string,
): Promise<ElectronPackageVerification> {
    if (process.platform !== "darwin") {
        throw new Error(
            "Electron package verification currently supports the macOS ARM64 release target only",
        );
    }
    if (
        typeof inputPath !== "string" ||
        !isAbsolute(inputPath) ||
        !inputPath.endsWith(".app")
    ) {
        throw new Error("Package verification requires an absolute .app path");
    }

    const appPath = await realpath(inputPath);
    const appStat = await lstat(appPath);
    if (!appStat.isDirectory() || appStat.isSymbolicLink()) {
        throw new Error(`Packaged app is not a directory: ${appPath}`);
    }

    const infoPlistPath = join(appPath, "Contents", "Info.plist");
    const frameworkRoot = join(
        appPath,
        "Contents",
        "Frameworks",
        "Electron Framework.framework",
        "Versions",
        "A",
    );
    const mainExecutable = join(
        appPath,
        "Contents",
        "MacOS",
        basename(appPath, ".app"),
    );
    const frameworkExecutable = join(frameworkRoot, "Electron Framework");
    const frameworkInfoPlist = join(frameworkRoot, "Resources", "Info.plist");

    await execFileAsync("/usr/bin/codesign", [
        "--verify",
        "--deep",
        "--strict",
        appPath,
    ]);

    const bundleId = await plistValue(infoPlistPath, "CFBundleIdentifier");
    if (bundleId !== EXPECTED_BUNDLE_ID) {
        throw new Error(`Unexpected bundle identifier: ${bundleId}`);
    }

    const electronVersion = await plistValue(
        frameworkInfoPlist,
        "CFBundleVersion",
    );
    if (electronVersion !== EXPECTED_ELECTRON_VERSION) {
        throw new Error(`Unexpected Electron version: ${electronVersion}`);
    }

    const mainArchitectures = await architectures(mainExecutable);
    const frameworkArchitectures = await architectures(frameworkExecutable);
    if (
        mainArchitectures !== EXPECTED_ARCHITECTURES ||
        frameworkArchitectures !== EXPECTED_ARCHITECTURES
    ) {
        throw new Error(
            `Expected ARM64-only binaries, received app=${mainArchitectures}, framework=${frameworkArchitectures}`,
        );
    }

    const locales = await verifyElectronLocales(
        packagedElectronFrameworkResourcesPath(appPath),
    );
    const terminalRuntime = await verifyTerminalRuntime(appPath);
    const fuses = await getCurrentFuseWire(appPath);
    verifyFuses(fuses);
    const asarHash = await verifyAsarIntegrity(infoPlistPath);
    const sizeKiB = await appSizeKiB(appPath);
    if (sizeKiB > MAX_APP_SIZE_KIB) {
        throw new Error(
            `Packaged app exceeds 250 MiB: ${(sizeKiB / 1024).toFixed(2)} MiB (${sizeKiB} KiB)`,
        );
    }

    return Object.freeze({
        appPath,
        bundleId,
        electronVersion,
        architectures: mainArchitectures,
        localeCount: locales.locales.length,
        locales: locales.locales,
        sizeKiB,
        sizeMiB: Number((sizeKiB / 1024).toFixed(2)),
        asarHash,
        codesign: "valid (--deep --strict)",
        terminalRuntime,
        fuses: Object.fromEntries(
            [...expectedFuses].map(([fuse, state]: any) => [
                FuseV1Options[fuse],
                state === FuseState.ENABLE,
            ]),
        ),
    });
}

const scriptPath = fileURLToPath(import.meta.url);
const isEntryPoint =
    process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath;

if (isEntryPoint) {
    const defaultAppPath = resolvePackagedAppPath({
        cwd: resolve(dirname(scriptPath), ".."),
    });
    const requestedPath =
        process.argv[2] === undefined
            ? defaultAppPath
            : resolve(process.argv[2]);
    verifyElectronPackage(requestedPath).then(
        (report: any) =>
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`),
        (error: any) => {
            process.stderr.write(
                `${error instanceof Error ? error.message : String(error)}\n`,
            );
            process.exitCode = 1;
        },
    );
}
