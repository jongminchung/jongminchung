import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

async function fileState(path) {
    try {
        const metadata = await lstat(path);
        if (metadata.isSymbolicLink()) return "symlink";
        return metadata.isFile() ? "file" : "other";
    } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT")
            return "missing";
        throw error;
    }
}

async function defaultArchitectures(path) {
    const { stdout } = await execFileAsync("/usr/bin/lipo", ["-archs", path], {
        encoding: "utf8",
    });
    return stdout.trim().split(/\s+/u).filter(Boolean);
}

async function defaultBuild(nodeGypScript, moduleRoot) {
    await execFileAsync(process.execPath, [nodeGypScript, "rebuild"], {
        cwd: moduleRoot,
        env: { ...process.env, npm_config_build_from_source: "true" },
        maxBuffer: 10 * 1024 * 1024,
    });
}

export async function ensureDmgMakerNativeBinding(options = {}) {
    const platform = options.platform ?? process.platform;
    const architecture = options.architecture ?? process.arch;
    if (platform !== "darwin") return Object.freeze({ skipped: true });
    if (architecture !== "arm64") {
        throw new Error(
            `DMG maker native binding requires arm64, received ${architecture}`,
        );
    }

    const nodeGypScript =
        options.nodeGypScript ?? require.resolve("node-gyp/bin/node-gyp.js");
    const modules = options.modules ?? [
        {
            bindingName: "volume.node",
            moduleName: "macos-alias",
            moduleRoot: dirname(require.resolve("macos-alias/package.json")),
        },
        {
            bindingName: "xattr.node",
            moduleName: "fs-xattr",
            moduleRoot: dirname(require.resolve("fs-xattr/package.json")),
        },
    ];
    const bindings = [];
    const rebuilt = [];
    for (const module of modules) {
        const binding = join(
            module.moduleRoot,
            "build",
            "Release",
            module.bindingName,
        );
        let state = await fileState(binding);
        if (state === "symlink") {
            throw new Error(
                `${module.moduleName} native binding must not be a symbolic link`,
            );
        }
        if (state === "other") {
            throw new Error(
                `${module.moduleName} native binding must be a regular file`,
            );
        }
        if (state === "missing") {
            await (options.build ?? defaultBuild)(
                nodeGypScript,
                module.moduleRoot,
            );
            rebuilt.push(module.moduleName);
            state = await fileState(binding);
            if (state !== "file") {
                throw new Error(
                    `${module.moduleName} native binding build did not produce ${module.bindingName}`,
                );
            }
        }

        const architectures = await (
            options.architectures ?? defaultArchitectures
        )(binding);
        if (architectures.length !== 1 || architectures[0] !== architecture) {
            throw new Error(
                `${module.moduleName} native binding must contain only ${architecture}, received ${architectures.join(", ")}`,
            );
        }
        bindings.push(binding);
    }
    return Object.freeze({
        bindings: Object.freeze(bindings),
        rebuilt: Object.freeze(rebuilt),
        skipped: false,
    });
}
