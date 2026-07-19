import { createRequire } from "node:module";
import { chmodSync, existsSync, lstatSync } from "node:fs";
import { dirname, join } from "node:path";
import type { IPty, IPtyForkOptions } from "node-pty";
import type {
    PtyProcess,
    PtyProcessExit,
    PtySpawner,
    PtySpawnOptions,
} from "./terminal-utility";

class NodePtyProcess implements PtyProcess {
    readonly #pty: IPty;

    constructor(pty: IPty) {
        this.#pty = pty;
    }

    onData(listener: (data: string) => void): () => void {
        const disposable = this.#pty.onData(listener);
        return () => disposable.dispose();
    }

    onExit(listener: (event: PtyProcessExit) => void): () => void {
        const disposable = this.#pty.onExit((event) => {
            listener({
                exitCode: event.exitCode,
                signal: event.signal ?? null,
            });
        });
        return () => disposable.dispose();
    }

    write(data: string): void {
        this.#pty.write(data);
    }

    resize(cols: number, rows: number): void {
        this.#pty.resize(cols, rows);
    }

    kill(): void {
        this.#pty.kill();
    }
}

export class NodePtySpawner implements PtySpawner {
    spawn(
        shell: string,
        args: readonly string[],
        options: PtySpawnOptions,
    ): PtyProcess {
        const ptyOptions: IPtyForkOptions = {
            cwd: options.cwd,
            cols: options.cols,
            rows: options.rows,
            env: { ...options.env },
            name: options.name,
            encoding: "utf8",
        };
        const nodePty = loadNodePty();
        return new NodePtyProcess(nodePty.spawn(shell, [...args], ptyOptions));
    }
}

interface NodePtyModule {
    spawn(
        file: string,
        args: readonly string[],
        options: IPtyForkOptions,
    ): IPty;
}

function loadNodePty(): NodePtyModule {
    const require = createRequire(__filename);
    const resourcesPath: unknown = Reflect.get(process, "resourcesPath");
    const packagedModule =
        typeof resourcesPath === "string"
            ? join(resourcesPath, "node-pty")
            : null;
    const moduleId =
        packagedModule !== null &&
        existsSync(join(packagedModule, "package.json"))
            ? packagedModule
            : "node-pty";
    const moduleRoot =
        moduleId === "node-pty"
            ? dirname(require.resolve("node-pty/package.json"))
            : moduleId;
    ensureDarwinSpawnHelperExecutable(moduleRoot);
    const required: unknown = require(moduleId);
    if (
        typeof required !== "object" ||
        required === null ||
        typeof Reflect.get(required, "spawn") !== "function"
    ) {
        throw new Error("Packaged node-pty module is invalid");
    }
    return required as NodePtyModule;
}

function ensureDarwinSpawnHelperExecutable(moduleRoot: string): void {
    if (process.platform !== "darwin") return;
    const helper = join(
        moduleRoot,
        "prebuilds",
        `darwin-${process.arch}`,
        "spawn-helper",
    );
    const metadata = lstatSync(helper);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
        throw new Error(
            "Packaged node-pty spawn-helper must be a regular file",
        );
    }
    if ((metadata.mode & 0o111) !== 0) return;
    chmodSync(helper, metadata.mode | 0o111);
}
