import { mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertReleaseBundleMetadata,
  createReleaseArtifactNames,
  createTauriBuildArguments,
  findReleaseVersionArgument,
  parseReleaseVersion,
  requireMacArm64,
  stageReleaseArtifact,
} from "./release.mjs";

describe("release build contract", () => {
  it("accepts a stable semantic release version", () => {
    expect(parseReleaseVersion("1.2.3")).toBe("1.2.3");
  });

  it("rejects malformed or prerelease versions", () => {
    for (const version of ["1.2", "01.2.3", "1.2.3-beta.1", "v1.2.3", undefined]) {
      expect(() => parseReleaseVersion(version)).toThrow("stable semantic version");
    }
  });

  it("uses deterministic macOS ARM64 artifact names", () => {
    expect(createReleaseArtifactNames("1.2.3")).toEqual({
      checksum: "Git-Client_1.2.3_macos_aarch64.dmg.sha256",
      dmg: "Git-Client_1.2.3_macos_aarch64.dmg",
    });
  });

  it("rejects release builds outside macOS ARM64", () => {
    expect(requireMacArm64("darwin", "arm64")).toBe("aarch64");
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

  it("builds an unsigned DMG with an ephemeral Tauri version", () => {
    expect(createTauriBuildArguments("1.2.3")).toEqual([
      "exec",
      "tauri",
      "build",
      "--ci",
      "--no-sign",
      "--config",
      '{"version":"1.2.3"}',
      "--bundles",
      "dmg",
    ]);
  });

  it("ignores pnpm's argument separator when reading the release version", () => {
    expect(findReleaseVersionArgument(["--", "1.2.3"])).toBe("1.2.3");
    expect(() => findReleaseVersionArgument(["--"])).toThrow("version argument");
  });

  it("stages a DMG with a verifiable SHA-256 checksum", async () => {
    const directory = await mkdtemp(join(tmpdir(), "git-client-release-"));
    const source = join(directory, "source.dmg");
    const output = join(directory, "artifacts");

    try {
      await writeFile(source, "abc");
      const artifacts = await stageReleaseArtifact(source, output, "1.2.3");

      expect(artifacts).toEqual({
        checksum: join(output, "Git-Client_1.2.3_macos_aarch64.dmg.sha256"),
        dmg: join(output, "Git-Client_1.2.3_macos_aarch64.dmg"),
      });
      expect(await readFile(artifacts.dmg, "utf8")).toBe("abc");
      expect(await readFile(artifacts.checksum, "utf8")).toBe(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  Git-Client_1.2.3_macos_aarch64.dmg\n",
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects a DMG larger than the release budget", async () => {
    const directory = await mkdtemp(join(tmpdir(), "git-client-release-"));
    const source = join(directory, "oversized.dmg");

    try {
      await writeFile(source, "");
      await truncate(source, 75 * 1024 * 1024 + 1);
      await expect(
        stageReleaseArtifact(source, join(directory, "artifacts"), "1.2.3"),
      ).rejects.toThrow("75 MiB");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
