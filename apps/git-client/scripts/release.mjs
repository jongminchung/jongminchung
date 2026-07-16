import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { captureCommand, executeCommand } from "./process.mjs";

const maxReleaseBytes = 75 * 1024 * 1024;
const stableSemverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseReleaseVersion(value) {
  if (typeof value !== "string" || !stableSemverPattern.test(value)) {
    throw new Error(`Expected a stable semantic version, received: ${String(value)}`);
  }
  return value;
}

export function createReleaseArtifactNames(value) {
  const version = parseReleaseVersion(value);
  const dmg = `Git-Client_${version}_macos_aarch64.dmg`;
  return { checksum: `${dmg}.sha256`, dmg };
}

export function requireMacArm64(platform, architecture) {
  if (platform !== "darwin" || architecture !== "arm64") {
    throw new Error(`Release builds require macOS ARM64, received: ${platform}/${architecture}`);
  }
  return "aarch64";
}

export function assertReleaseBundleMetadata(actualVersion, actualArchitectures, value) {
  const version = parseReleaseVersion(value);
  if (actualVersion.trim() !== version) {
    throw new Error(
      `Release app version mismatch: expected ${version}, received ${actualVersion.trim()}`,
    );
  }
  const architectures = actualArchitectures.trim().split(/\s+/).filter(Boolean);
  if (architectures.length !== 1 || architectures[0] !== "arm64") {
    throw new Error(
      `Release executable must contain only arm64, received: ${architectures.join(", ")}`,
    );
  }
}

export function createTauriBuildArguments(value) {
  const version = parseReleaseVersion(value);
  return [
    "exec",
    "tauri",
    "build",
    "--ci",
    "--no-sign",
    "--config",
    JSON.stringify({ version }),
    "--bundles",
    "dmg",
  ];
}

export function findReleaseVersionArgument(arguments_) {
  const value = arguments_.find((argument) => argument !== "--");
  if (value === undefined) throw new Error("Expected a release version argument");
  return parseReleaseVersion(value);
}

export async function stageReleaseArtifact(source, outputDirectory, value) {
  const names = createReleaseArtifactNames(value);
  const sourceStats = await stat(source);
  if (sourceStats.size > maxReleaseBytes) {
    throw new Error(`Release DMG exceeds the 75 MiB budget: ${sourceStats.size} bytes`);
  }
  const dmg = join(outputDirectory, names.dmg);
  const checksum = join(outputDirectory, names.checksum);
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(source, dmg);
  const digest = createHash("sha256")
    .update(await readFile(dmg))
    .digest("hex");
  await writeFile(checksum, `${digest}  ${names.dmg}\n`);
  return { checksum, dmg };
}

async function findSingleDmg(directory) {
  const entries = (await readdir(directory)).filter((entry) => entry.endsWith(".dmg"));
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one release DMG in ${directory}, found ${entries.length}`);
  }
  return join(directory, entries[0]);
}

export async function validateReleaseDmg(dmg, value) {
  const version = parseReleaseVersion(value);
  const mountPoint = await mkdtemp(join(tmpdir(), "git-client-release-dmg-"));
  let mounted = false;

  try {
    await executeCommand(
      "hdiutil",
      ["attach", dmg, "-readonly", "-nobrowse", "-mountpoint", mountPoint, "-quiet"],
      { capture: true },
    );
    mounted = true;

    const apps = (await readdir(mountPoint, { withFileTypes: true })).filter(
      (entry) => entry.isDirectory() && entry.name.endsWith(".app"),
    );
    if (apps.length !== 1) {
      throw new Error(`Expected exactly one app in the release DMG, found ${apps.length}`);
    }

    const app = join(mountPoint, apps[0].name);
    const executableDirectory = join(app, "Contents", "MacOS");
    const executables = (await readdir(executableDirectory, { withFileTypes: true })).filter(
      (entry) => entry.isFile(),
    );
    if (executables.length !== 1) {
      throw new Error(`Expected exactly one app executable, found ${executables.length}`);
    }

    const actualVersion = await captureCommand(
      "plutil",
      [
        "-extract",
        "CFBundleShortVersionString",
        "raw",
        "-o",
        "-",
        join(app, "Contents", "Info.plist"),
      ],
      {},
    );
    const actualArchitectures = await captureCommand(
      "lipo",
      ["-archs", join(executableDirectory, executables[0].name)],
      {},
    );
    assertReleaseBundleMetadata(actualVersion, actualArchitectures, version);
  } finally {
    if (mounted) {
      await executeCommand("hdiutil", ["detach", mountPoint, "-quiet"], {
        allowFailure: true,
        capture: true,
      });
    }
    await rm(mountPoint, { force: true, recursive: true });
  }
}

export async function buildRelease(value) {
  const version = parseReleaseVersion(value);
  requireMacArm64(process.platform, process.arch);

  const appRoot = fileURLToPath(new URL("../", import.meta.url));
  const dmgDirectory = join(appRoot, "src-tauri", "target", "release", "bundle", "dmg");
  const outputDirectory = join(appRoot, "release-artifacts");
  await rm(dmgDirectory, { force: true, recursive: true });
  await rm(outputDirectory, { force: true, recursive: true });
  await executeCommand("pnpm", createTauriBuildArguments(version), { cwd: appRoot });

  const artifacts = await stageReleaseArtifact(
    await findSingleDmg(dmgDirectory),
    outputDirectory,
    version,
  );
  await validateReleaseDmg(artifacts.dmg, version);
  return artifacts;
}

async function main() {
  const artifacts = await buildRelease(findReleaseVersionArgument(process.argv.slice(2)));
  console.log(`Release DMG: ${artifacts.dmg}`);
  console.log(`Checksum: ${artifacts.checksum}`);
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
