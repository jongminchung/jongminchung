import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { chmod, cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { pruneElectronLocales } from "./scripts/electron-package-policy.mjs";
import { ensureDmgMakerNativeBinding } from "./scripts/ensure-dmg-maker-native.mjs";
import { verifyElectronPackage } from "./scripts/verify-electron-package.mjs";

const execFileAsync = promisify(execFile);
const releaseMode = process.env.GIT_CLIENT_RELEASE_MODE?.trim() || null;
const releaseVersion = process.env.GIT_CLIENT_RELEASE_VERSION?.trim() || null;
const releaseSigningIdentity =
    process.env.GIT_CLIENT_CODESIGN_IDENTITY?.trim() || null;
const notarizationKeychainProfile =
    process.env.GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE?.trim() || null;
const notarizationKeychain =
    process.env.GIT_CLIENT_NOTARY_KEYCHAIN?.trim() || null;
const packageRoot = dirname(fileURLToPath(import.meta.url));
const nodePtySource = realpathSync(join(packageRoot, "node_modules/node-pty"));
const nodePtyResource = join(
    tmpdir(),
    "git-client-electron-native-resources/node-pty",
);

if (
    releaseMode !== null &&
    releaseMode !== "production" &&
    releaseMode !== "local-ad-hoc"
) {
    throw new Error(`Unknown GIT_CLIENT_RELEASE_MODE: ${releaseMode}`);
}
if (
    releaseVersion !== null &&
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(releaseVersion)
) {
    throw new Error(
        `GIT_CLIENT_RELEASE_VERSION must be stable SemVer: ${releaseVersion}`,
    );
}
if (releaseMode !== null && releaseVersion === null) {
    throw new Error(
        "Electron release packaging requires GIT_CLIENT_RELEASE_VERSION",
    );
}
if (releaseMode === "production") {
    if (releaseSigningIdentity === null) {
        throw new Error(
            "Production Electron packaging requires GIT_CLIENT_CODESIGN_IDENTITY",
        );
    }
    if (notarizationKeychainProfile === null) {
        throw new Error(
            "Production Electron packaging requires GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE",
        );
    }
}

const config: ForgeConfig = {
    packagerConfig: {
        name: "Git Client",
        executableName: "Git Client",
        appBundleId: "io.github.jongminchung.gitclient",
        appCategoryType: "public.app-category.developer-tools",
        asar: true,
        extraResource: [nodePtyResource],
        icon: "src-tauri/icons/icon",
        ...(releaseVersion === null
            ? {}
            : { appVersion: releaseVersion, buildVersion: releaseVersion }),
        afterExtract: [
            (buildPath, _electronVersion, platform, _arch, done) => {
                pruneElectronLocales({ buildPath, platform }).then(
                    (report) => {
                        if (!report.skipped) {
                            console.info(
                                `[package] kept ${report.kept.length} Electron locales and removed ${report.removed.length}`,
                            );
                        }
                        done();
                    },
                    (error: unknown) =>
                        done(
                            error instanceof Error
                                ? error
                                : new Error(String(error)),
                        ),
                );
            },
        ],
        ...(releaseSigningIdentity === null
            ? {}
            : { osxSign: { identity: releaseSigningIdentity } }),
        ...(notarizationKeychainProfile === null
            ? {}
            : {
                  osxNotarize: {
                      keychainProfile: notarizationKeychainProfile,
                      ...(notarizationKeychain === null
                          ? {}
                          : { keychain: notarizationKeychain }),
                  },
              }),
    },
    hooks: {
        async generateAssets() {
            await ensureDmgMakerNativeBinding();
            await rm(nodePtyResource, { recursive: true, force: true });
            await mkdir(join(nodePtyResource, "prebuilds"), {
                recursive: true,
            });
            await Promise.all([
                cp(
                    join(nodePtySource, "package.json"),
                    join(nodePtyResource, "package.json"),
                ),
                cp(join(nodePtySource, "lib"), join(nodePtyResource, "lib"), {
                    recursive: true,
                }),
                cp(
                    join(nodePtySource, "prebuilds/darwin-arm64"),
                    join(nodePtyResource, "prebuilds/darwin-arm64"),
                    { recursive: true },
                ),
            ]);
            await chmod(
                join(nodePtyResource, "prebuilds/darwin-arm64/spawn-helper"),
                0o755,
            );
        },
        async postPackage(_forgeConfig, packageResult) {
            if (packageResult.platform !== "darwin") return;
            for (const outputPath of packageResult.outputPaths) {
                const appPath = join(outputPath, "Git Client.app");
                if (releaseSigningIdentity === null) {
                    await execFileAsync("/usr/bin/codesign", [
                        "--force",
                        "--deep",
                        "--sign",
                        "-",
                        appPath,
                    ]);
                }
                await execFileAsync("/usr/bin/codesign", [
                    "--verify",
                    "--deep",
                    "--strict",
                    appPath,
                ]);
                const verification = await verifyElectronPackage(appPath);
                console.info(
                    `[package] verified Electron ${verification.electronVersion}, ${verification.sizeMiB.toFixed(2)} MiB, ${verification.localeCount} locales`,
                );
            }
        },
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-dmg",
            platforms: ["darwin"],
            config: {
                format: "ULFO",
                name: "Git Client",
                icon: "src-tauri/icons/icon.icns",
            },
        },
    ],
    plugins: [
        new AutoUnpackNativesPlugin({}),
        new VitePlugin({
            concurrent: true,
            build: [
                { entry: "electron/main.ts", config: "vite.main.config.ts" },
                {
                    entry: "electron/preload.ts",
                    config: "vite.preload.config.ts",
                    target: "preload",
                },
                {
                    entry: "electron/utility/git/entry.ts",
                    config: "vite.utility.config.ts",
                },
                {
                    entry: "electron/utility/terminal/entry.ts",
                    config: "vite.terminal.config.ts",
                },
            ],
            renderer: [
                { name: "main_window", config: "vite.renderer.config.ts" },
            ],
        }),
        new FusesPlugin({
            version: FuseVersion.V1,
            resetAdHocDarwinSignature: true,
            strictlyRequireAllFuses: true,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
            [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
            [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
            [FuseV1Options.WasmTrapHandlers]: true,
        }),
    ],
};

export default config;
