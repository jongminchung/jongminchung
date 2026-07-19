import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeCommand } from "./process.mjs";
import { createReproducibleDmg } from "./reproducible-dmg.mjs";
import { verifyElectronPackage } from "./verify-electron-package.mjs";

export const MAX_RELEASE_DMG_BYTES = 160 * 1024 * 1024;
export const RELEASE_MODES = Object.freeze({
  localAdHoc: "local-ad-hoc",
  production: "production",
});

const expectedElectronVersion = "43.1.1";
const stableSemverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const developerIdApplicationPattern = /^Developer ID Application: .+ \([A-Z0-9]+\)$/u;

export function parseReleaseVersion(value) {
  if (typeof value !== "string" || !stableSemverPattern.test(value)) {
    throw new Error(`Expected a stable semantic version, received: ${String(value)}`);
  }
  return value;
}

export function parseReleaseMode(value) {
  if (value === RELEASE_MODES.production || value === RELEASE_MODES.localAdHoc) return value;
  throw new Error(`Unknown release mode: ${String(value)}`);
}

export function createReleaseArtifactNames(value, mode = RELEASE_MODES.production) {
  const version = parseReleaseVersion(value);
  const validatedMode = parseReleaseMode(mode);
  const suffix = validatedMode === RELEASE_MODES.localAdHoc ? "_adhoc" : "";
  const dmg = `Git-Client_${version}_macos_arm64${suffix}.dmg`;
  return { checksum: `${dmg}.sha256`, dmg };
}

export function requireMacArm64(platform, architecture) {
  if (platform !== "darwin" || architecture !== "arm64") {
    throw new Error(`Release builds require macOS ARM64, received: ${platform}/${architecture}`);
  }
  return "arm64";
}

export function assertReleaseBundleMetadata(actualVersion, actualArchitectures, value) {
  const version = parseReleaseVersion(value);
  if (actualVersion.trim() !== version) {
    throw new Error(
      `Release app version mismatch: expected ${version}, received ${actualVersion.trim()}`,
    );
  }
  const architectures = actualArchitectures.trim().split(/\s+/u).filter(Boolean);
  if (architectures.length !== 1 || architectures[0] !== "arm64") {
    throw new Error(
      `Release executable must contain only arm64, received: ${architectures.join(", ")}`,
    );
  }
}

export function createElectronMakeArguments() {
  return ["electron:make", "--platform=darwin", "--arch=arm64"];
}

export function createReleaseSourceGateCommands(mode = RELEASE_MODES.production) {
  const validatedMode = parseReleaseMode(mode);
  const commonGates = [
    Object.freeze({ command: "pnpm", arguments: Object.freeze(["test"]) }),
    Object.freeze({ command: "pnpm", arguments: Object.freeze(["build"]) }),
    Object.freeze({
      command: "pnpm",
      arguments: Object.freeze(["test:electron-package-policy"]),
    }),
  ];
  if (validatedMode === RELEASE_MODES.production) {
    commonGates.push(
      Object.freeze({ command: "pnpm", arguments: Object.freeze(["parity:check"]) }),
    );
  }
  return Object.freeze(commonGates);
}

function requireEnvironmentValue(environment, name) {
  const rawValue = environment[name];
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) throw new Error(`Production release requires ${name}`);
  return value;
}

export function resolveReleaseSecurity(mode, environment = process.env) {
  const validatedMode = parseReleaseMode(mode);
  if (validatedMode === RELEASE_MODES.localAdHoc) {
    return Object.freeze({ identity: null, keychainProfile: null, mode: validatedMode });
  }

  const identity = requireEnvironmentValue(environment, "GIT_CLIENT_CODESIGN_IDENTITY");
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

export function createReleaseBuildEnvironment(environment, value, mode = RELEASE_MODES.production) {
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

export function findReleaseArguments(arguments_) {
  const normalized = arguments_.filter((argument) => argument !== "--");
  const localAdHocFlags = normalized.filter((argument) => argument === "--local-ad-hoc");
  const unknownFlag = normalized.find(
    (argument) => argument.startsWith("--") && argument !== "--local-ad-hoc",
  );
  if (unknownFlag !== undefined) throw new Error(`Unknown release argument: ${unknownFlag}`);
  if (localAdHocFlags.length > 1) throw new Error("Duplicate --local-ad-hoc release argument");
  const values = normalized.filter((argument) => argument !== "--local-ad-hoc");
  if (values.length !== 1) throw new Error("Expected exactly one release version argument");
  return Object.freeze({
    mode: localAdHocFlags.length === 1 ? RELEASE_MODES.localAdHoc : RELEASE_MODES.production,
    version: parseReleaseVersion(values[0]),
  });
}

export function findReleaseVersionArgument(arguments_) {
  return findReleaseArguments(arguments_).version;
}

async function createSha256(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

export async function stageReleaseArtifact(
  source,
  outputDirectory,
  value,
  mode = RELEASE_MODES.production,
) {
  const names = createReleaseArtifactNames(value, mode);
  const sourceStats = await stat(source);
  if (!sourceStats.isFile()) throw new Error(`Release DMG is not a regular file: ${source}`);
  if (sourceStats.size > MAX_RELEASE_DMG_BYTES) {
    throw new Error(`Release DMG exceeds the 160 MiB budget: ${sourceStats.size} bytes`);
  }
  const dmg = join(outputDirectory, names.dmg);
  const checksum = join(outputDirectory, names.checksum);
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(source, dmg);
  const digest = await createSha256(dmg);
  await writeFile(checksum, `${digest}  ${names.dmg}\n`);
  return Object.freeze({ checksum, dmg, mode: parseReleaseMode(mode) });
}

async function visitForgeOutput(directory, found) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (entry.name.endsWith(".app") || entry.name.endsWith(".dmg")) {
        throw new Error(`Refusing symlinked Electron release output: ${entryPath}`);
      }
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name.endsWith(".app")) found.apps.push(entryPath);
      else await visitForgeOutput(entryPath, found);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".dmg")) found.dmgs.push(entryPath);
  }
}

export async function discoverForgeOutputs(outputDirectory) {
  const found = { apps: [], dmgs: [] };
  await visitForgeOutput(outputDirectory, found);
  found.apps.sort((left, right) => left.localeCompare(right));
  found.dmgs.sort((left, right) => left.localeCompare(right));
  if (found.apps.length !== 1 || found.dmgs.length !== 1) {
    throw new Error(
      `Expected exactly one Electron app and one DMG in ${outputDirectory}, found ${found.apps.length} app(s) and ${found.dmgs.length} DMG(s)`,
    );
  }
  if (basename(found.apps[0]) !== "Git Client.app") {
    throw new Error(`Unexpected Electron app name: ${basename(found.apps[0])}`);
  }
  return Object.freeze({ app: found.apps[0], dmg: found.dmgs[0] });
}

function commandOutput(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
}

export async function assertDeveloperIdIdentityAvailable(identity, runCommand = executeCommand) {
  if (!developerIdApplicationPattern.test(identity)) {
    throw new Error("Production release identity is not a Developer ID Application identity");
  }
  const result = await runCommand(
    "/usr/bin/security",
    ["find-identity", "-v", "-p", "codesigning"],
    { capture: true },
  );
  const output = commandOutput(result);
  if (!output.split("\n").some((line) => line.includes(`"${identity}"`))) {
    throw new Error(`Developer ID signing identity is not available in the keychain: ${identity}`);
  }
}

export function assertDeveloperIdSignatureOutput(output, identity) {
  const lines = output.split("\n").map((line) => line.trim());
  if (
    !lines.includes(`Authority=${identity}`) ||
    lines.some((line) => line === "Signature=adhoc")
  ) {
    throw new Error(
      `Release app is not signed with the requested Developer ID identity: ${identity}`,
    );
  }
}

export async function verifyProductionApp(appPath, identity, runCommand = executeCommand) {
  await runCommand(
    "/usr/bin/codesign",
    ["--verify", "--deep", "--strict", "--verbose=4", appPath],
    { capture: true },
  );
  const details = await runCommand("/usr/bin/codesign", ["-d", "--verbose=4", appPath], {
    capture: true,
  });
  assertDeveloperIdSignatureOutput(commandOutput(details), identity);
  await runCommand("/usr/sbin/spctl", ["--assess", "--type", "execute", "--verbose=4", appPath], {
    capture: true,
  });
  await runCommand("/usr/bin/xcrun", ["stapler", "validate", appPath], { capture: true });
}

async function readReleaseBundleMetadata(appPath, runCommand) {
  const executableDirectory = join(appPath, "Contents", "MacOS");
  const executables = (await readdir(executableDirectory, { withFileTypes: true })).filter(
    (entry) => entry.isFile() && !entry.isSymbolicLink(),
  );
  if (executables.length !== 1) {
    throw new Error(`Expected exactly one app executable, found ${executables.length}`);
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
    ["-archs", join(executableDirectory, executables[0].name)],
    { capture: true },
  );
  return Object.freeze({
    architectures: architectureResult.stdout.trim(),
    version: versionResult.stdout.trim(),
  });
}

export async function validateReleaseApp(
  appPath,
  value,
  {
    identity = null,
    mode = RELEASE_MODES.production,
    runCommand = executeCommand,
    verifyPackage = verifyElectronPackage,
  } = {},
) {
  const validatedMode = parseReleaseMode(mode);
  const metadata = await readReleaseBundleMetadata(appPath, runCommand);
  assertReleaseBundleMetadata(metadata.version, metadata.architectures, value);
  const verification = await verifyPackage(appPath);
  if (verification.electronVersion !== expectedElectronVersion) {
    throw new Error(
      `Release package verifier returned Electron ${verification.electronVersion}; expected ${expectedElectronVersion}`,
    );
  }
  if (validatedMode === RELEASE_MODES.production) {
    if (identity === null)
      throw new Error("Production app verification requires a signing identity");
    await verifyProductionApp(appPath, identity, runCommand);
  }
  return verification;
}

export async function validateReleaseDmg(dmg, value, options = {}) {
  const mountPoint = await mkdtemp(join(tmpdir(), "git-client-release-dmg-"));
  const runCommand = options.runCommand ?? executeCommand;
  let mounted = false;

  try {
    await runCommand(
      "/usr/bin/hdiutil",
      ["attach", dmg, "-readonly", "-nobrowse", "-mountpoint", mountPoint, "-quiet"],
      { capture: true },
    );
    mounted = true;
    const apps = (await readdir(mountPoint, { withFileTypes: true })).filter(
      (entry) => entry.isDirectory() && !entry.isSymbolicLink() && entry.name.endsWith(".app"),
    );
    if (apps.length !== 1) {
      throw new Error(`Expected exactly one app in the release DMG, found ${apps.length}`);
    }
    await validateReleaseApp(join(mountPoint, apps[0].name), value, {
      ...options,
      runCommand,
    });
  } finally {
    if (mounted) {
      await runCommand("/usr/bin/hdiutil", ["detach", mountPoint, "-quiet"], {
        allowFailure: true,
        capture: true,
      });
    }
    await rm(mountPoint, { force: true, recursive: true });
  }
}

export async function buildRelease(value, options = {}) {
  const version = parseReleaseVersion(value);
  const mode = parseReleaseMode(options.mode ?? RELEASE_MODES.production);
  requireMacArm64(options.platform ?? process.platform, options.architecture ?? process.arch);

  const appRoot = options.appRoot ?? fileURLToPath(new URL("../", import.meta.url));
  const outputDirectory = join(appRoot, "release-artifacts");
  const forgeOutputDirectory = join(appRoot, "out");
  const runCommand = options.runCommand ?? executeCommand;
  const environment = options.environment ?? process.env;
  const security = resolveReleaseSecurity(mode, environment);
  const releaseEnvironment = createReleaseBuildEnvironment(environment, version, mode);
  const validateApp = options.validateApp ?? validateReleaseApp;
  const validateDmg = options.validateDmg ?? validateReleaseDmg;
  const createDmg = options.createDmg ?? createReproducibleDmg;

  if (security.identity !== null) {
    await assertDeveloperIdIdentityAvailable(security.identity, runCommand);
  }

  for (const gate of createReleaseSourceGateCommands(mode)) {
    await runCommand(gate.command, [...gate.arguments], {
      cwd: appRoot,
      env: releaseEnvironment,
    });
  }

  await rm(forgeOutputDirectory, { force: true, recursive: true });
  await rm(outputDirectory, { force: true, recursive: true });
  await runCommand("pnpm", createElectronMakeArguments(), {
    cwd: appRoot,
    env: releaseEnvironment,
  });

  const forgeOutputs = await discoverForgeOutputs(forgeOutputDirectory);
  const reproducibleDirectory = await mkdtemp(join(tmpdir(), "git-client-release-image-"));
  const reproducibleDmg = join(reproducibleDirectory, "Git Client.dmg");
  const validationOptions = {
    identity: security.identity,
    mode,
    runCommand,
    verifyPackage: options.verifyPackage ?? verifyElectronPackage,
  };
  try {
    await validateApp(forgeOutputs.app, version, validationOptions);
    await createDmg(forgeOutputs.app, reproducibleDmg, { runCommand });
    await validateDmg(reproducibleDmg, version, validationOptions);
    const artifacts = await stageReleaseArtifact(
      reproducibleDmg,
      outputDirectory,
      version,
      mode,
    );
    return Object.freeze({ ...artifacts, app: forgeOutputs.app });
  } finally {
    await rm(reproducibleDirectory, { force: true, recursive: true });
  }
}

async function main() {
  const requested = findReleaseArguments(process.argv.slice(2));
  const artifacts = await buildRelease(requested.version, { mode: requested.mode });
  console.log(`Release mode: ${String(artifacts.mode)}`);
  console.log(`Verified app: ${String(artifacts.app)}`);
  console.log(`Release DMG: ${String(artifacts.dmg)}`);
  console.log(`SHA-256 manifest: ${String(artifacts.checksum)}`);
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
