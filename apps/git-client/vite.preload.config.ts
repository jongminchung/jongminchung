import { builtinModules } from "node:module";
import { defineConfig, type Plugin } from "vite";

const NODE_BUILTINS = new Set(
    builtinModules.flatMap((specifier) => [specifier, `node:${specifier}`]),
);
const MODULE_LOAD = /\b(?:require|import)\(\s*["']([^"']+)["']/gu;

export function containsNodeBuiltinImport(code: string): boolean {
    return [...code.matchAll(MODULE_LOAD)].some((match) =>
        NODE_BUILTINS.has(match[1] ?? ""),
    );
}

export function rejectNodeBuiltinsInSandboxedPreload(): Plugin {
    return {
        name: "reject-node-builtins-in-sandboxed-preload",
        generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type !== "chunk") continue;
                if (containsNodeBuiltinImport(output.code)) {
                    this.error(
                        `Sandboxed preload ${output.fileName} contains a node: built-in import`,
                    );
                }
            }
        },
    };
}

export default defineConfig({
    plugins: [rejectNodeBuiltinsInSandboxedPreload()],
    build: {
        sourcemap: true,
        rollupOptions: {
            external: ["electron"],
            output: {
                entryFileNames: "preload.cjs",
                format: "cjs",
            },
        },
    },
});
