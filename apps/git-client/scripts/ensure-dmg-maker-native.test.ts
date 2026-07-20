import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDmgMakerNativeBinding } from "./ensure-dmg-maker-native.mjs";

const temporaryDirectories: string[] = [];

async function fixture(): Promise<{ binding: string; root: string }> {
  const root = await mkdtemp(join(tmpdir(), "git-client-dmg-native-"));
  temporaryDirectories.push(root);
  const binding = join(root, "build", "Release", "volume.node");
  await mkdir(join(root, "build", "Release"), { recursive: true });
  return { binding, root };
}

function nativeModule(root: string, bindingName = "volume.node") {
  return [{ bindingName, moduleName: "fixture-native", moduleRoot: root }];
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("DMG maker native binding preflight", () => {
  it("builds a missing binding before Forge loads the maker", async () => {
    const { binding, root } = await fixture();
    const build = vi.fn(async (_nodeGypScript: string, moduleRoot: string) => {
      expect(moduleRoot).toBe(root);
      await writeFile(binding, "arm64 fixture");
    });

    await expect(
      ensureDmgMakerNativeBinding({
        architecture: "arm64",
        architectures: async () => ["arm64"],
        build,
        modules: nativeModule(root),
        nodeGypScript: "/node-gyp.js",
        platform: "darwin",
      }),
    ).resolves.toMatchObject({
      bindings: [binding],
      rebuilt: ["fixture-native"],
      skipped: false,
    });
    expect(build).toHaveBeenCalledOnce();
  });

  it("does not rebuild an existing arm64 binding", async () => {
    const { binding, root } = await fixture();
    await writeFile(binding, "arm64 fixture");
    const build = vi.fn();

    await expect(
      ensureDmgMakerNativeBinding({
        architecture: "arm64",
        architectures: async () => ["arm64"],
        build,
        modules: nativeModule(root),
        nodeGypScript: "/node-gyp.js",
        platform: "darwin",
      }),
    ).resolves.toMatchObject({ rebuilt: [], skipped: false });
    expect(build).not.toHaveBeenCalled();
  });

  it("rejects symlinked and wrong-architecture bindings", async () => {
    const symlinkFixture = await fixture();
    const target = join(symlinkFixture.root, "target.node");
    await writeFile(target, "target");
    await symlink(target, symlinkFixture.binding);
    await expect(
      ensureDmgMakerNativeBinding({
        architecture: "arm64",
        modules: nativeModule(symlinkFixture.root),
        nodeGypScript: "/node-gyp.js",
        platform: "darwin",
      }),
    ).rejects.toThrow("fixture-native native binding must not be a symbolic link");

    const architectureFixture = await fixture();
    await writeFile(architectureFixture.binding, "x64 fixture");
    await expect(
      ensureDmgMakerNativeBinding({
        architecture: "arm64",
        architectures: async () => ["x86_64"],
        modules: nativeModule(architectureFixture.root),
        nodeGypScript: "/node-gyp.js",
        platform: "darwin",
      }),
    ).rejects.toThrow("fixture-native native binding must contain only arm64");
  });

  it("builds every missing Forge DMG native dependency", async () => {
    const alias = await fixture();
    const xattr = await fixture();
    const xattrBinding = join(xattr.root, "build", "Release", "xattr.node");
    const build = vi.fn(async (_nodeGypScript: string, moduleRoot: string) => {
      await writeFile(moduleRoot === alias.root ? alias.binding : xattrBinding, "arm64 fixture");
    });

    await expect(
      ensureDmgMakerNativeBinding({
        architecture: "arm64",
        architectures: async () => ["arm64"],
        build,
        modules: [
          {
            bindingName: "volume.node",
            moduleName: "macos-alias",
            moduleRoot: alias.root,
          },
          {
            bindingName: "xattr.node",
            moduleName: "fs-xattr",
            moduleRoot: xattr.root,
          },
        ],
        nodeGypScript: "/node-gyp.js",
        platform: "darwin",
      }),
    ).resolves.toMatchObject({ rebuilt: ["macos-alias", "fs-xattr"] });
    expect(build).toHaveBeenCalledTimes(2);
  });
});
