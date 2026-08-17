// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
    copyFile,
    mkdir,
    mkdtemp,
    readdir,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeCommand } from "./process.ts";
import { createReproducibleDmg } from "./reproducible-dmg.ts";
import { smokeElectronPackage } from "./smoke-electron-package.ts";
import { verifyElectronPackage } from "./verify-electron-package.ts";

export const MAX_RELEASE_DMG_BYTES = 160 * 1024 * 1024;
export const RELEASE_MODES = Object.freeze({
    localAdHoc: "local-ad-hoc",
    production: "production",
});

const expectedElectronVersion = "43.3.0";
const stableSemverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const developerIdApplicationPattern =
    /^Developer ID Application: .+ \([A-Z0-9]+\)$/u;
const sourceShaPattern = /^[0-9a-f]{40}$/u;

export function parseReleaseVersion(value: any) {
    if (typeof value !== "string" || !stableSemverPattern.test(value)) {
        throw new Error(
            `Expected a stable semantic version, received: ${String(value)}`,
        );
    }
    return value;
}

export function parseReleaseMode(value: any) {
    if (
        value === RELEASE_MODES.production ||
        value === RELEASE_MODES.localAdHoc
    )
        return value;
    throw new Error(`Unknown release mode: ${String(value)}`);
}

export function createReleaseArtifactNames(
    value: any,
    mode: any = RELEASE_MODES.production,
) {
    const version = parseReleaseVersion(value);
    const validatedMode = parseReleaseMode(mode);
    const suffix = validatedMode === RELEASE_MODES.localAdHoc ? "_adhoc" : "";
    const dmg = `Git-Client_${version}_macos_arm64${suffix}.dmg`;
    return {
        checksum: `${dmg}.sha256`,
        dmg,
        provenance: `${dmg}.provenance.json`,
    };
}

function parseSourceSha(value: any) {
    if (typeof value !== "string" || !sourceShaPattern.test(value)) {
        throw new Error(
            `Expected a full Git source SHA, received: ${String(value)}`,
        );
    }
    return value;
}

export async function verifyReleaseSource(
    workspaceRoot: any,
    { expectedSha = null, fetch = true, runCommand = executeCommand }: any = {},
) {
    const cwd = resolve(workspaceRoot);
    const git = async (arguments_: any) =>
        runCommand("git", arguments_, {
            capture: true,
            cwd,
        });
    if (fetch) {
        await git([
            "fetch",
            "--tags",
            "--prune",
            "origin",
            "+refs/heads/main:refs/remotes/origin/main",
        ]);
    }

    const status = await git([
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
    ]);
    if (status.stdout.trim() !== "") {
        throw new Error("Release source worktree must be clean.");
    }
    const branch = (
        await git(["symbolic-ref", "--quiet", "--short", "HEAD"])
    ).stdout.trim();
    if (branch !== "main") {
        throw new Error(
            `Release source branch must be main, received: ${branch || "detached HEAD"}`,
        );
    }
    const sourceSha = parseSourceSha(
        (await git(["rev-parse", "HEAD"])).stdout.trim(),
    );
    const remoteSha = parseSourceSha(
        (await git(["rev-parse", "refs/remotes/origin/main"])).stdout.trim(),
    );
    if (sourceSha !== remoteSha) {
        throw new Error(
            `Release source must exactly match origin/main: ${sourceSha} != ${remoteSha}`,
        );
    }
    if (expectedSha !== null && sourceSha !== parseSourceSha(expectedSha)) {
        throw new Error(
            `Release source changed during validation: ${String(expectedSha)} != ${sourceSha}`,
        );
    }
    return Object.freeze({ sourceSha });
}

export function requireMacArm64(platform: any, architecture: any) {
    if (platform !== "darwin" || architecture !== "arm64") {
        throw new Error(
            `Release builds require macOS ARM64, received: ${platform}/${architecture}`,
        );
    }
    return "arm64";
}

export function assertReleaseBundleMetadata(
    actualVersion: any,
    actualArchitectures: any,
    value: any,
) {
    const version = parseReleaseVersion(value);
    if (actualVersion.trim() !== version) {
        throw new Error(
            `Release app version mismatch: expected ${version}, received ${actualVersion.trim()}`,
        );
    }
    const architectures = actualArchitectures
        .trim()
        .split(/\s+/u)
        .filter(Boolean);
    if (architectures.length !== 1 || architectures[0] !== "arm64") {
        throw new Error(
            `Release executable must contain only arm64, received: ${architectures.join(", ")}`,
        );
    }
}

export function createElectronPackageArguments() {
    return ["electron:package", "--platform=darwin", "--arch=arm64"];
}

export function createReleaseSourceGateCommands(
    mode: any = RELEASE_MODES.production,
) {
    parseReleaseMode(mode);
    const commonGates = [
        Object.freeze({ command: "pnpm", arguments: Object.freeze(["test"]) }),
        Object.freeze({
            command: "pnpm",
            arguments: Object.freeze(["test:e2e"]),
        }),
        Object.freeze({ command: "pnpm", arguments: Object.freeze(["build"]) }),
        Object.freeze({
            command: "pnpm",
            arguments: Object.freeze(["test:integration:native"]),
        }),
    ];
    return Object.freeze(commonGates);
}

function requireEnvironmentValue(environment: any, name: any) {
    const rawValue = environment[name];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) throw new Error(`Production release requires ${name}`);
    return value;
}

export function resolveReleaseSecurity(
    mode: any,
    environment: any = process.env,
) {
    const validatedMode = parseReleaseMode(mode);
    if (validatedMode === RELEASE_MODES.localAdHoc) {
        return Object.freeze({
            identity: null,
            keychainProfile: null,
            mode: validatedMode,
        });
    }

    const identity = requireEnvironmentValue(
        environment,
        "GIT_CLIENT_CODESIGN_IDENTITY",
    );
    if (!developerIdApplicationPattern.test(identity)) {
        throw new Error(
            "GIT_CLIENT_CODESIGN_IDENTITY must be a full Developer ID Application identity",
        );
    }
    const keychainProfile = requireEnvironmentValue(
        environment,
        "GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE",
    );
    return Object.freeze({ identity, keychainProfile, mode: validatedMode });
}

export function createReleaseBuildEnvironment(
    environment: any,
    value: any,
    mode: any = RELEASE_MODES.production,
) {
    const version = parseReleaseVersion(value);
    const security = resolveReleaseSecurity(mode, environment);
    const releaseEnvironment = {
        ...environment,
        CI: "true",
        GIT_CLIENT_RELEASE_MODE: security.mode,
        GIT_CLIENT_RELEASE_VERSION: version,
    };

    if (security.mode === RELEASE_MODES.localAdHoc) {
        releaseEnvironment.GIT_CLIENT_CODESIGN_IDENTITY = "";
        releaseEnvironment.GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE = "";
    }
    return releaseEnvironment;
}

export function findReleaseArguments(arguments_: any) {
    const normalized = arguments_.filter((argument: any) => argument !== "--");
    const localAdHocFlags = normalized.filter(
        (argument: any) => argument === "--local-ad-hoc",
    );
    const unknownFlag = normalized.find(
        (argument: any) =>
            argument.startsWith("--") && argument !== "--local-ad-hoc",
    );
    if (unknownFlag !== undefined)
        throw new Error(`Unknown release argument: ${unknownFlag}`);
    if (localAdHocFlags.length > 1)
        throw new Error("Duplicate --local-ad-hoc release argument");
    const values = normalized.filter(
        (argument: any) => argument !== "--local-ad-hoc",
    );
    if (values.length !== 1)
        throw new Error("Expected exactly one release version argument");
    return Object.freeze({
        mode:
            localAdHocFlags.length === 1
                ? RELEASE_MODES.localAdHoc
                : RELEASE_MODES.production,
        version: parseReleaseVersion(values[0]),
    });
}

export function findReleaseVersionArgument(arguments_: any) {
    return findReleaseArguments(arguments_).version;
}

async function createSha256(filePath: any) {
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(filePath)) digest.update(chunk);
    return digest.digest("hex");
}

export async function stageReleaseArtifact(
    source: any,
    outputDirectory: any,
    value: any,
    sourceSha: any,
    mode: any = RELEASE_MODES.production,
) {
    const names = createReleaseArtifactNames(value, mode);
    const validatedSourceSha = parseSourceSha(sourceSha);
    const validatedMode = parseReleaseMode(mode);
    const sourceStats = await stat(source);
    if (!sourceStats.isFile())
        throw new Error(`Release DMG is not a regular file: ${source}`);
    if (sourceStats.size > MAX_RELEASE_DMG_BYTES) {
        throw new Error(
            `Release DMG exceeds the 160 MiB budget: ${sourceStats.size} bytes`,
        );
    }
    const dmg = join(outputDirectory, names.dmg);
    const checksum = join(outputDirectory, names.checksum);
    const provenance = join(outputDirectory, names.provenance);
    await mkdir(outputDirectory, { recursive: true });
    await copyFile(source, dmg);
    const digest = await createSha256(dmg);
    await writeFile(checksum, `${digest}  ${names.dmg}\n`);
    await writeFile(
        provenance,
        `${JSON.stringify(
            {
                schemaVersion: 1,
                repository: "jongminchung/jongminchung",
                ref: "refs/heads/main",
                sourceSha: validatedSourceSha,
                releaseVersion: parseReleaseVersion(value),
                mode: validatedMode,
                artifact: {
                    name: names.dmg,
                    sha256: digest,
                    sizeBytes: sourceStats.size,
                },
            },
            null,
            2,
        )}\n`,
        { encoding: "utf8", mode: 0o600 },
    );
    return Object.freeze({
        checksum,
        dmg,
        mode: validatedMode,
        provenance,
        sourceSha: validatedSourceSha,
    });
}

async function visitForgeOutput(directory: any, found: any) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = join(directory, entry.name);
        if (entry.isSymbolicLink()) {
            if (entry.name.endsWith(".app") || entry.name.endsWith(".dmg")) {
                throw new Error(
                    `Refusing symlinked Electron release output: ${entryPath}`,
                );
            }
            continue;
        }
        if (entry.isDirectory()) {
            if (entry.name.endsWith(".app")) found.apps.push(entryPath);
            else await visitForgeOutput(entryPath, found);
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(".dmg"))
            found.dmgs.push(entryPath);
    }
}

export async function discoverForgeOutputs(outputDirectory: any) {
    const found: { apps: string[]; dmgs: string[] } = { apps: [], dmgs: [] };
    await visitForgeOutput(outputDirectory, found);
    found.apps.sort((left: any, right: any) => left.localeCompare(right));
    found.dmgs.sort((left: any, right: any) => left.localeCompare(right));
    if (found.apps.length !== 1 || found.dmgs.length !== 0) {
        throw new Error(
            `Expected exactly one Electron app and no DMG in ${outputDirectory}, found ${found.apps.length} app(s) and ${found.dmgs.length} DMG(s)`,
        );
    }
    const appPath = found.apps[0];
    if (appPath === undefined) throw new Error("Expected one Electron app");
    if (basename(appPath) !== "Git Client.app") {
        throw new Error(`Unexpected Electron app name: ${basename(appPath)}`);
    }
    return Object.freeze({ app: appPath });
}

function commandOutput(result: any) {
    return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
}

export async function assertDeveloperIdIdentityAvailable(
    identity: any,
    runCommand: any = executeCommand,
) {
    if (!developerIdApplicationPattern.test(identity)) {
        throw new Error(
            "Production release identity is not a Developer ID Application identity",
        );
    }
    const result = await runCommand(
        "/usr/bin/security",
        ["find-identity", "-v", "-p", "codesigning"],
        { capture: true },
    );
    const output = commandOutput(result);
    if (
        !output.split("\n").some((line: any) => line.includes(`"${identity}"`))
    ) {
        throw new Error(
            `Developer ID signing identity is not available in the keychain: ${identity}`,
        );
    }
}

export function assertDeveloperIdSignatureOutput(output: any, identity: any) {
    const lines = output.split("\n").map((line: any) => line.trim());
    if (
        !lines.includes(`Authority=${identity}`) ||
        lines.some((line: any) => line === "Signature=adhoc")
    ) {
        throw new Error(
            `Release app is not signed with the requested Developer ID identity: ${identity}`,
        );
    }
}

export async function verifyProductionApp(
    appPath: any,
    identity: any,
    runCommand: any = executeCommand,
) {
    await runCommand(
        "/usr/bin/codesign",
        ["--verify", "--deep", "--strict", "--verbose=4", appPath],
        { capture: true },
    );
    const details = await runCommand(
        "/usr/bin/codesign",
        ["-d", "--verbose=4", appPath],
        {
            capture: true,
        },
    );
    assertDeveloperIdSignatureOutput(commandOutput(details), identity);
    await runCommand(
        "/usr/sbin/spctl",
        ["--assess", "--type", "execute", "--verbose=4", appPath],
        {
            capture: true,
        },
    );
    await runCommand("/usr/bin/xcrun", ["stapler", "validate", appPath], {
        capture: true,
    });
}

async function readReleaseBundleMetadata(appPath: any, runCommand: any) {
    const executableDirectory = join(appPath, "Contents", "MacOS");
    const executables = (
        await readdir(executableDirectory, { withFileTypes: true })
    ).filter((entry: any) => entry.isFile() && !entry.isSymbolicLink());
    if (executables.length !== 1) {
        throw new Error(
            `Expected exactly one app executable, found ${executables.length}`,
        );
    }
    const versionResult = await runCommand(
        "/usr/bin/plutil",
        [
            "-extract",
            "CFBundleShortVersionString",
            "raw",
            "-o",
            "-",
            join(appPath, "Contents", "Info.plist"),
        ],
        { capture: true },
    );
    const architectureResult = await runCommand(
        "/usr/bin/lipo",
        ["-archs", join(executableDirectory, executables[0]!.name)],
        { capture: true },
    );
    return Object.freeze({
        architectures: architectureResult.stdout.trim(),
        version: versionResult.stdout.trim(),
    });
}

export async function validateReleaseApp(
    appPath: any,
    value: any,
    {
        identity = null,
        mode = RELEASE_MODES.production,
        runCommand = executeCommand,
        verifyPackage = verifyElectronPackage,
    }: any = {},
) {
    const validatedMode = parseReleaseMode(mode);
    const metadata = await readReleaseBundleMetadata(appPath, runCommand);
    assertReleaseBundleMetadata(
        metadata.version,
        metadata.architectures,
        value,
    );
    const verification = await verifyPackage(appPath);
    if (verification.electronVersion !== expectedElectronVersion) {
        throw new Error(
            `Release package verifier returned Electron ${verification.electronVersion}; expected ${expectedElectronVersion}`,
        );
    }
    if (validatedMode === RELEASE_MODES.production) {
        if (identity === null)
            throw new Error(
                "Production app verification requires a signing identity",
            );
        await verifyProductionApp(appPath, identity, runCommand);
    }
    return verification;
}

export async function validateReleaseDmg(
    dmg: any,
    value: any,
    options: any = {},
) {
    const mountPoint = await mkdtemp(join(tmpdir(), "git-client-release-dmg-"));
    const runCommand = options.runCommand ?? executeCommand;
    let mounted = false;

    try {
        await runCommand(
            "/usr/bin/hdiutil",
            [
                "attach",
                dmg,
                "-readonly",
                "-nobrowse",
                "-mountpoint",
                mountPoint,
                "-quiet",
            ],
            { capture: true },
        );
        mounted = true;
        const apps = (
            await readdir(mountPoint, { withFileTypes: true })
        ).filter(
            (entry: any) =>
                entry.isDirectory() &&
                !entry.isSymbolicLink() &&
                entry.name.endsWith(".app"),
        );
        if (apps.length !== 1) {
            throw new Error(
                `Expected exactly one app in the release DMG, found ${apps.length}`,
            );
        }
        await validateReleaseApp(join(mountPoint, apps[0]!.name), value, {
            ...options,
            runCommand,
        });
    } finally {
        if (mounted) {
            await runCommand(
                "/usr/bin/hdiutil",
                ["detach", mountPoint, "-quiet"],
                {
                    allowFailure: true,
                    capture: true,
                },
            );
        }
        await rm(mountPoint, { force: true, recursive: true });
    }
}

export async function buildRelease(value: any, options: any = {}) {
    const version = parseReleaseVersion(value);
    const mode = parseReleaseMode(options.mode ?? RELEASE_MODES.production);
    requireMacArm64(
        options.platform ?? process.platform,
        options.architecture ?? process.arch,
    );

    const appRoot =
        options.appRoot ?? fileURLToPath(new URL("../", import.meta.url));
    const outputDirectory = join(appRoot, "release-artifacts");
    const forgeOutputDirectory = join(appRoot, "out");
    const runCommand = options.runCommand ?? executeCommand;
    const environment = options.environment ?? process.env;
    const security = resolveReleaseSecurity(mode, environment);
    const releaseEnvironment = createReleaseBuildEnvironment(
        environment,
        version,
        mode,
    );
    const validateApp = options.validateApp ?? validateReleaseApp;
    const validateDmg = options.validateDmg ?? validateReleaseDmg;
    const createDmg = options.createDmg ?? createReproducibleDmg;
    const smokeApp = options.smokeApp ?? smokeElectronPackage;
    const verifySource = options.verifySource ?? verifyReleaseSource;
    const workspaceRoot = options.workspaceRoot ?? resolve(appRoot, "../..");

    const { sourceSha } = await verifySource(workspaceRoot, { runCommand });

    if (security.identity !== null) {
        await assertDeveloperIdIdentityAvailable(security.identity, runCommand);
    }

    for (const gate of createReleaseSourceGateCommands(mode)) {
        await runCommand(gate.command, [...gate.arguments], {
            cwd: appRoot,
            env: releaseEnvironment,
        });
    }
    await verifySource(workspaceRoot, {
        expectedSha: sourceSha,
        fetch: false,
        runCommand,
    });

    await rm(forgeOutputDirectory, { force: true, recursive: true });
    await rm(outputDirectory, { force: true, recursive: true });
    await runCommand("pnpm", createElectronPackageArguments(), {
        cwd: appRoot,
        env: releaseEnvironment,
    });

    const forgeOutputs = await discoverForgeOutputs(forgeOutputDirectory);
    await verifySource(workspaceRoot, {
        expectedSha: sourceSha,
        fetch: false,
        runCommand,
    });
    const reproducibleDirectory = await mkdtemp(
        join(tmpdir(), "git-client-release-image-"),
    );
    const reproducibleDmg = join(reproducibleDirectory, "Git Client.dmg");
    const validationOptions = {
        identity: security.identity,
        mode,
        runCommand,
        verifyPackage: options.verifyPackage ?? verifyElectronPackage,
    };
    try {
        await validateApp(forgeOutputs.app, version, validationOptions);
        await smokeApp(forgeOutputs.app);
        await createDmg(forgeOutputs.app, reproducibleDmg, { runCommand });
        await validateDmg(reproducibleDmg, version, validationOptions);
        await verifySource(workspaceRoot, {
            expectedSha: sourceSha,
            fetch: false,
            runCommand,
        });
        const artifacts = await stageReleaseArtifact(
            reproducibleDmg,
            outputDirectory,
            version,
            sourceSha,
            mode,
        );
        return Object.freeze({ ...artifacts, app: forgeOutputs.app });
    } finally {
        await rm(reproducibleDirectory, { force: true, recursive: true });
    }
}

async function main() {
    const requested = findReleaseArguments(process.argv.slice(2));
    const artifacts = await buildRelease(requested.version, {
        mode: requested.mode,
    });
    console.log(`Release mode: ${String(artifacts.mode)}`);
    console.log(`Verified app: ${String(artifacts.app)}`);
    console.log(`Release DMG: ${String(artifacts.dmg)}`);
    console.log(`SHA-256 manifest: ${String(artifacts.checksum)}`);
    console.log(`Source provenance: ${String(artifacts.provenance)}`);
}

const entryPoint = process.argv[1];
if (entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)) {
    try {
        await main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
