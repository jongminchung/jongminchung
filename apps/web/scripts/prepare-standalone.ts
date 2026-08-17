import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const standaloneRoot = join(appRoot, ".next", "standalone", "apps", "web");
const standaloneStaticRoot = join(standaloneRoot, ".next", "static");
const standaloneServer = join(standaloneRoot, "server.js");

await access(standaloneServer);
await rm(join(standaloneRoot, "public"), { force: true, recursive: true });
await rm(standaloneStaticRoot, { force: true, recursive: true });
await mkdir(join(standaloneRoot, ".next"), { recursive: true });
await cp(join(appRoot, "public"), join(standaloneRoot, "public"), {
    recursive: true,
});
await cp(join(appRoot, ".next", "static"), standaloneStaticRoot, {
    recursive: true,
});

process.stdout.write(`Prepared standalone Web assets in ${standaloneRoot}.\n`);
