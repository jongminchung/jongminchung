import { copyFile, mkdir, mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_RELEASE_DMG_BYTES,
  RELEASE_MODES,
  assertDeveloperIdIdentityAvailable,
  assertDeveloperIdSignatureOutput,
  assertReleaseBundleMetadata,
  buildRelease,
  createElectronMakeArguments,
  createReleaseArtifactNames,
  createReleaseBuildEnvironment,
  createReleaseSourceGateCommands,
  discoverForgeOutputs,
  findReleaseArguments,
  findReleaseVersionArgument,
  parseReleaseVersion,
  requireMacArm64,
  resolveReleaseSecurity,
  stageReleaseArtifact,
  validateReleaseApp,
} from "./release.mjs";

const productionEnvironment = Object.freeze({
  GIT_CLIENT_CODESIGN_IDENTITY: "Developer ID Application: Example Corp (TEAM123456)",
  GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE: "git-client-release",
  PATH: "/usr/bin",
});

async function createForgeFixture(appRoot: string): Promise<void> {
  await mkdir(join(appRoot, "out", "packages", "Git Client-darwin-arm64", "Git Client.app"), {
    recursive: true,
  });
  await mkdir(join(appRoot, "out", "make", "dmg", "arm64"), { recursive: true });
  await writeFile(join(appRoot, "out", "make", "dmg", "arm64", "Git Client.dmg"), "dmg");
}

async function createDmgFixture(appRoot: string, target: string): Promise<void> {
  await copyFile(join(appRoot, "out", "make", "dmg", "arm64", "Git Client.dmg"), target);
}

describe("Electron release build contract", () => {
  it("accepts a stable semantic release version", () => {
    expect(parseReleaseVersion("1.2.3")).toBe("1.2.3");
  });

  it("rejects malformed or prerelease versions", () => {
    for (const version of ["1.2", "01.2.3", "1.2.3-beta.1", "v1.2.3", undefined]) {
      expect(() => parseReleaseVersion(version)).toThrow("stable semantic version");
    }
  });

  it("uses deterministic production and visibly ad-hoc ARM64 artifact names", () => {
    expect(createReleaseArtifactNames("1.2.3")).toEqual({
      checksum: "Git-Client_1.2.3_macos_arm64.dmg.sha256",
      dmg: "Git-Client_1.2.3_macos_arm64.dmg",
    });
    expect(createReleaseArtifactNames("1.2.3", RELEASE_MODES.localAdHoc)).toEqual({
      checksum: "Git-Client_1.2.3_macos_arm64_adhoc.dmg.sha256",
      dmg: "Git-Client_1.2.3_macos_arm64_adhoc.dmg",
    });
  });

  it("rejects release builds outside macOS ARM64", () => {
    expect(requireMacArm64("darwin", "arm64")).toBe("arm64");
    expect(() => requireMacArm64("darwin", "x64")).toThrow("macOS ARM64");
    expect(() => requireMacArm64("linux", "arm64")).toThrow("macOS ARM64");
  });

  it("accepts only the requested app version and a single arm64 executable", () => {
    expect(() => assertReleaseBundleMetadata("1.2.3", "arm64", "1.2.3")).not.toThrow();
    expect(() => assertReleaseBundleMetadata("1.2.4", "arm64", "1.2.3")).toThrow(
      "version mismatch",
    );
    expect(() => assertReleaseBundleMetadata("1.2.3", "x86_64 arm64", "1.2.3")).toThrow(
      "only arm64",
    );
  });

  it("runs source test/build/package-policy gates before an ARM64 Electron Forge make", () => {
    expect(createReleaseSourceGateCommands()).toEqual([
      { command: "pnpm", arguments: ["test"] },
      { command: "pnpm", arguments: ["build"] },
      { command: "pnpm", arguments: ["test:electron-package-policy"] },
      { command: "pnpm", arguments: ["parity:check"] },
    ]);
    expect(createReleaseSourceGateCommands(RELEASE_MODES.localAdHoc)).toEqual([
      { command: "pnpm", arguments: ["test"] },
      { command: "pnpm", arguments: ["build"] },
      { command: "pnpm", arguments: ["test:electron-package-policy"] },
    ]);
    expect(createElectronMakeArguments()).toEqual([
      "electron:make",
      "--platform=darwin",
      "--arch=arm64",
    ]);
  });

  it("requires Developer ID and notarization configuration for production", () => {
    expect(resolveReleaseSecurity(RELEASE_MODES.production, productionEnvironment)).toEqual({
      identity: productionEnvironment.GIT_CLIENT_CODESIGN_IDENTITY,
      keychainProfile: productionEnvironment.GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE,
      mode: RELEASE_MODES.production,
    });
    expect(() => resolveReleaseSecurity(RELEASE_MODES.production, {})).toThrow(
      "GIT_CLIENT_CODESIGN_IDENTITY",
    );
    expect(() =>
      resolveReleaseSecurity(RELEASE_MODES.production, {
        GIT_CLIENT_CODESIGN_IDENTITY: productionEnvironment.GIT_CLIENT_CODESIGN_IDENTITY,
      }),
    ).toThrow("GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE");
    expect(() =>
      resolveReleaseSecurity(RELEASE_MODES.production, {
        ...productionEnvironment,
        GIT_CLIENT_CODESIGN_IDENTITY: "-",
      }),
    ).toThrow("Developer ID Application");
  });

  it("creates an explicit release environment without leaking production signing into ad-hoc mode", () => {
    expect(
      createReleaseBuildEnvironment(productionEnvironment, "1.2.3", RELEASE_MODES.production),
    ).toMatchObject({
      CI: "true",
      GIT_CLIENT_RELEASE_MODE: "production",
      GIT_CLIENT_RELEASE_VERSION: "1.2.3",
      GIT_CLIENT_CODESIGN_IDENTITY: productionEnvironment.GIT_CLIENT_CODESIGN_IDENTITY,
      GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE: productionEnvironment.GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE,
    });
    expect(
      createReleaseBuildEnvironment(productionEnvironment, "1.2.3", RELEASE_MODES.localAdHoc),
    ).toMatchObject({
      CI: "true",
      GIT_CLIENT_RELEASE_MODE: "local-ad-hoc",
      GIT_CLIENT_RELEASE_VERSION: "1.2.3",
      GIT_CLIENT_CODESIGN_IDENTITY: "",
      GIT_CLIENT_NOTARY_KEYCHAIN_PROFILE: "",
    });
  });

  it("parses production by default and requires an explicit local ad-hoc flag", () => {
    expect(findReleaseArguments(["--", "1.2.3"])).toEqual({
      mode: RELEASE_MODES.production,
      version: "1.2.3",
    });
    expect(findReleaseArguments(["--local-ad-hoc", "1.2.3"])).toEqual({
      mode: RELEASE_MODES.localAdHoc,
      version: "1.2.3",
    });
    expect(findReleaseVersionArgument(["--", "1.2.3"])).toBe("1.2.3");
    expect(() => findReleaseArguments(["--"])).toThrow("exactly one");
    expect(() => findReleaseArguments(["--unknown", "1.2.3"])).toThrow("Unknown release argument");
    expect(() => findReleaseArguments(["--local-ad-hoc", "--local-ad-hoc", "1.2.3"])).toThrow(
      "Duplicate",
    );
  });

  it("stages a DMG with a streaming SHA-256 manifest", async () => {
    const directory = await mkdtemp(join(tmpdir(), "git-client-release-"));
    const source = join(directory, "source.dmg");
    const output = join(directory, "artifacts");

    try {
      await writeFile(source, "abc");
      const artifacts = await stageReleaseArtifact(source, output, "1.2.3");

      expect(artifacts).toEqual({
        checksum: join(output, "Git-Client_1.2.3_macos_arm64.dmg.sha256"),
        dmg: join(output, "Git-Client_1.2.3_macos_arm64.dmg"),
        mode: RELEASE_MODES.production,
      });
      expect(await readFile(artifacts.dmg, "utf8")).toBe("abc");
      expect(await readFile(artifacts.checksum, "utf8")).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  Git-Client_1.2.3_macos_arm64.dmg\n",
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects a DMG larger than the 160 MiB release budget", async () => {
    const directory = await mkdtemp(join(tmpdir(), "git-client-release-"));
    const source = join(directory, "oversized.dmg");

    try {
      await writeFile(source, "");
      await truncate(source, MAX_RELEASE_DMG_BYTES + 1);
      await expect(
        stageReleaseArtifact(source, join(directory, "artifacts"), "1.2.3"),
      ).rejects.toThrow("160 MiB");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("discovers exactly one nested Forge app and DMG while ignoring apps inside the bundle", async () => {
    const appRoot = await mkdtemp(join(tmpdir(), "git-client-forge-output-"));
    try {
      await createForgeFixture(appRoot);
      await mkdir(
        join(
          appRoot,
          "out",
          "packages",
          "Git Client-darwin-arm64",
          "Git Client.app",
          "Contents",
          "Frameworks",
          "Git Client Helper.app",
        ),
        { recursive: true },
      );
      await expect(discoverForgeOutputs(join(appRoot, "out"))).resolves.toEqual({
        app: join(appRoot, "out", "packages", "Git Client-darwin-arm64", "Git Client.app"),
        dmg: join(appRoot, "out", "make", "dmg", "arm64", "Git Client.dmg"),
      });
      await writeFile(join(appRoot, "out", "make", "dmg", "arm64", "duplicate.dmg"), "dmg");
      await expect(discoverForgeOutputs(join(appRoot, "out"))).rejects.toThrow(
        "one Electron app and one DMG",
      );
    } finally {
      await rm(appRoot, { force: true, recursive: true });
    }
  });

  it("verifies the configured Developer ID identity from mocked keychain output", async () => {
    const identity = productionEnvironment.GIT_CLIENT_CODESIGN_IDENTITY;
    const runCommand = vi.fn().mockResolvedValue({
      code: 0,
      stderr: "",
      stdout: `  1) ABCDEF1234 "${identity}"`,
    });
    await expect(assertDeveloperIdIdentityAvailable(identity, runCommand)).resolves.toBeUndefined();
    expect(runCommand).toHaveBeenCalledWith(
      "/usr/bin/security",
      ["find-identity", "-v", "-p", "codesigning"],
      { capture: true },
    );

    runCommand.mockResolvedValue({ code: 0, stderr: "0 valid identities found", stdout: "" });
    await expect(assertDeveloperIdIdentityAvailable(identity, runCommand)).rejects.toThrow(
      "not available",
    );
  });

  it("rejects ad-hoc signature details for a production artifact", () => {
    const identity = productionEnvironment.GIT_CLIENT_CODESIGN_IDENTITY;
    expect(() => assertDeveloperIdSignatureOutput(`Authority=${identity}`, identity)).not.toThrow();
    expect(() =>
      assertDeveloperIdSignatureOutput(`Authority=${identity}\nSignature=adhoc`, identity),
    ).toThrow("not signed");
  });

  it("runs package, strict codesign, Gatekeeper, and notarization-ticket validation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "git-client-release-app-"));
    const appPath = join(directory, "Git Client.app");
    const executablePath = join(appPath, "Contents", "MacOS", "Git Client");
    const identity = productionEnvironment.GIT_CLIENT_CODESIGN_IDENTITY;
    const calls: string[] = [];
    const runCommand = vi.fn(async (command: string, arguments_: readonly string[]) => {
      calls.push(`${command} ${arguments_.join(" ")}`);
      if (command.endsWith("plutil")) return { code: 0, stderr: "", stdout: "1.2.3\n" };
      if (command.endsWith("lipo")) return { code: 0, stderr: "", stdout: "arm64\n" };
      if (arguments_[0] === "-d") {
        return { code: 0, stderr: `Authority=${identity}\n`, stdout: "" };
      }
      return { code: 0, stderr: "", stdout: "" };
    });
    const verifyPackage = vi.fn().mockResolvedValue({ electronVersion: "43.1.1" });

    try {
      await mkdir(join(appPath, "Contents", "MacOS"), { recursive: true });
      await writeFile(executablePath, "binary");
      await validateReleaseApp(appPath, "1.2.3", {
        identity,
        mode: RELEASE_MODES.production,
        runCommand,
        verifyPackage,
      });
      expect(verifyPackage).toHaveBeenCalledWith(appPath);
      expect(calls.some((call) => call.includes("codesign --verify --deep --strict"))).toBe(true);
      expect(calls.some((call) => call.includes("spctl --assess --type execute"))).toBe(true);
      expect(calls.some((call) => call.includes("xcrun stapler validate"))).toBe(true);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("fails closed before source gates when production signing configuration is missing", async () => {
    const appRoot = await mkdtemp(join(tmpdir(), "git-client-release-build-"));
    const runCommand = vi.fn();
    try {
      await expect(
        buildRelease("1.2.3", {
          appRoot,
          architecture: "arm64",
          environment: {},
          platform: "darwin",
          runCommand,
        }),
      ).rejects.toThrow("GIT_CLIENT_CODESIGN_IDENTITY");
      expect(runCommand).not.toHaveBeenCalled();
    } finally {
      await rm(appRoot, { force: true, recursive: true });
    }
  });

  it("executes the production Electron pipeline in order with mocked subprocesses", async () => {
    const appRoot = await mkdtemp(join(tmpdir(), "git-client-release-build-"));
    const calls: { readonly command: string; readonly arguments: readonly string[] }[] = [];
    const runCommand = vi.fn(async (command: string, arguments_: readonly string[]) => {
      calls.push({ command, arguments: [...arguments_] });
      if (command.endsWith("security")) {
        return {
          code: 0,
          stderr: "",
          stdout: `1) ABC "${productionEnvironment.GIT_CLIENT_CODESIGN_IDENTITY}"`,
        };
      }
      if (command === "pnpm" && arguments_[0] === "electron:make") {
        await createForgeFixture(appRoot);
      }
      return { code: 0, stderr: "", stdout: "" };
    });
    const validateApp = vi.fn().mockResolvedValue(undefined);
    const validateDmg = vi.fn().mockResolvedValue(undefined);

    try {
      const artifacts = await buildRelease("1.2.3", {
        appRoot,
        architecture: "arm64",
        environment: productionEnvironment,
        mode: RELEASE_MODES.production,
        platform: "darwin",
        createDmg: (_appPath: string, target: string) => createDmgFixture(appRoot, target),
        runCommand,
        validateApp,
        validateDmg,
      });

      expect(calls.map(({ command, arguments: arguments_ }) => [command, arguments_])).toEqual([
        ["/usr/bin/security", ["find-identity", "-v", "-p", "codesigning"]],
        ["pnpm", ["test"]],
        ["pnpm", ["build"]],
        ["pnpm", ["test:electron-package-policy"]],
        ["pnpm", ["parity:check"]],
        ["pnpm", createElectronMakeArguments()],
      ]);
      expect(validateApp).toHaveBeenCalledOnce();
      expect(validateDmg).toHaveBeenCalledOnce();
      expect(artifacts.dmg).toBe(
        join(appRoot, "release-artifacts", "Git-Client_1.2.3_macos_arm64.dmg"),
      );
      expect(await readFile(artifacts.checksum, "utf8")).toMatch(
        /^[a-f0-9]{64}  Git-Client_1\.2\.3_macos_arm64\.dmg\n$/u,
      );
    } finally {
      await rm(appRoot, { force: true, recursive: true });
    }
  });

  it("uses an explicit, visibly marked local ad-hoc validation pipeline", async () => {
    const appRoot = await mkdtemp(join(tmpdir(), "git-client-release-build-"));
    const calls: string[] = [];
    const runCommand = vi.fn(async (command: string, arguments_: readonly string[]) => {
      calls.push(command);
      if (command === "pnpm" && arguments_[0] === "electron:make") {
        await createForgeFixture(appRoot);
      }
      return { code: 0, stderr: "", stdout: "" };
    });

    try {
      const artifacts = await buildRelease("1.2.3", {
        appRoot,
        architecture: "arm64",
        environment: productionEnvironment,
        mode: RELEASE_MODES.localAdHoc,
        platform: "darwin",
        createDmg: (_appPath: string, target: string) => createDmgFixture(appRoot, target),
        runCommand,
        validateApp: vi.fn().mockResolvedValue(undefined),
        validateDmg: vi.fn().mockResolvedValue(undefined),
      });
      expect(calls).not.toContain("/usr/bin/security");
      expect(artifacts.mode).toBe(RELEASE_MODES.localAdHoc);
      expect(artifacts.dmg).toContain("_adhoc.dmg");
    } finally {
      await rm(appRoot, { force: true, recursive: true });
    }
  });
});
