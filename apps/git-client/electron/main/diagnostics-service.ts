import {
    appendFile,
    lstat,
    mkdir,
    readFile,
    readdir,
    realpath,
    rm,
    writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { app, BrowserWindow } from "electron";
import { strToU8, zipSync } from "fflate";
import type {
    DiagnosticConfigurationKind,
    DiagnosticLeftoverDirectory,
    DiagnosticPathKind,
    DiagnosticSnapshot,
    JsonValue,
    RuntimeInfo,
} from "../../src/shared/contracts/ipc";
import { DiagnosticSnapshotSchema } from "../../src/shared/contracts/ipc";

const MAX_LOG_ARCHIVE_INPUT_BYTES = 32 * 1_024 * 1_024;
const MAX_CONFIGURATION_BYTES = 1_048_576;
const CREDENTIAL_PREFIX = "hostingCredential:";
const ELECTRON_PROFILE_PREFIX = "Git Client Electron";
const MAX_LEFTOVER_DIRECTORIES = 32;
const MAX_LEFTOVER_DIRECTORY_ENTRIES = 100_000;
const LEFTOVER_PROFILE_NAME =
    /^Git Client Electron(?:$|[ -][A-Za-z0-9 ._-]+)$/u;

interface DiagnosticsPaths {
    readonly appData: string;
    readonly configuration: string;
    readonly crashDumps: string;
    readonly logs: string;
    readonly sessionData: string;
    readonly userData: string;
}

async function directorySize(root: string): Promise<number> {
    let visited = 0;
    const visit = async (directory: string): Promise<number> => {
        let total = 0;
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            visited += 1;
            if (visited > MAX_LEFTOVER_DIRECTORY_ENTRIES) {
                throw new Error(
                    "A leftover profile contains too many entries to inspect safely.",
                );
            }
            const path = join(directory, entry.name);
            const metadata = await lstat(path);
            if (metadata.isSymbolicLink()) continue;
            if (metadata.isDirectory()) total += await visit(path);
            else if (metadata.isFile()) total += metadata.size;
        }
        return total;
    };
    return visit(root);
}

function configurationFileName(kind: DiagnosticConfigurationKind): string {
    if (kind === "debugLog") return "debug-log-categories.txt";
    if (kind === "customProperties") return "git-client.properties";
    return "git-client.vmoptions";
}

function defaultConfiguration(kind: DiagnosticConfigurationKind): string {
    if (kind === "debugLog") {
        return "# Logger categories, one per line. Append :TRACE or :ALL for more detail.\n";
    }
    if (kind === "customProperties") {
        return "# Git Client custom properties\n";
    }
    return "# Applied to the Electron renderer after the next restart.\n--max-old-space-size=2048\n";
}

function validateConfiguration(
    kind: DiagnosticConfigurationKind,
    content: string,
): string {
    if (Buffer.byteLength(content, "utf8") > MAX_CONFIGURATION_BYTES) {
        throw new Error("Configuration files must be 1 MiB or smaller.");
    }
    if (content.includes("\0")) {
        throw new Error("Configuration files cannot contain null bytes.");
    }
    const lines = content.split(/\r?\n/u);
    if (kind === "vmOptions") {
        for (const line of lines) {
            const value = line.trim();
            if (!value || value.startsWith("#")) continue;
            const match = value.match(/^--max-old-space-size=(\d{3,5})$/u);
            const memory = match?.[1] ? Number(match[1]) : Number.NaN;
            if (!Number.isInteger(memory) || memory < 256 || memory > 32_768) {
                throw new Error(
                    "Only --max-old-space-size=256..32768 is supported.",
                );
            }
        }
    }
    if (kind === "customProperties") {
        for (const line of lines) {
            const value = line.trim();
            if (!value || value.startsWith("#")) continue;
            if (!/^[A-Za-z0-9_.-]{1,128}=.{0,4096}$/u.test(value)) {
                throw new Error("Custom properties must use key=value lines.");
            }
        }
    }
    if (kind === "debugLog") {
        for (const line of lines) {
            const value = line.trim();
            if (!value || value.startsWith("#")) continue;
            if (!/^[#A-Za-z0-9_.$-]{1,256}(?::(?:TRACE|ALL))?$/u.test(value)) {
                throw new Error(
                    "Debug log entries must be logger names with optional :TRACE or :ALL.",
                );
            }
        }
    }
    return content.endsWith("\n") ? content : `${content}\n`;
}

function shortcutDocument(): string {
    const rows: readonly (readonly [string, string])[] = [
        ["Search Everywhere", "Shift twice"],
        ["Find Action", "⌘⇧A"],
        ["Open", "⌘O"],
        ["Settings", "⌘,"],
        ["Commit", "⌘K"],
        ["Push", "⌘⇧K"],
        ["Pull", "⌘⇧L"],
        ["VCS Operations", "⌃V"],
        ["Terminal", "⌥F12"],
        ["Project", "⌘1"],
        ["Bookmarks", "⌘2"],
        ["Find in Files", "⌘⇧F"],
        ["Replace in Files", "⌘⇧R"],
        ["Quick Switch Scheme", "⌃`"],
    ];
    const body = rows
        .map(
            ([action, shortcut]) =>
                `<tr><td>${action}</td><td>${shortcut}</td></tr>`,
        )
        .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font:13px -apple-system,BlinkMacSystemFont,sans-serif;margin:44px;color:#202124}h1{font-size:24px;margin:0 0 6px}p{color:#5f6368;margin:0 0 24px}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #dadce0;padding:9px 4px}td:last-child{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right}</style></head><body><h1>Git Client Keyboard Shortcuts</h1><p>macOS keymap</p><table>${body}</table></body></html>`;
}

function reportSection(report: unknown, key: string): unknown {
    return typeof report === "object" && report !== null
        ? Reflect.get(report, key)
        : null;
}

export class DiagnosticsService {
    private constructor(
        private readonly paths: DiagnosticsPaths,
        private readonly runtime: RuntimeInfo,
    ) {}

    static create(runtime: RuntimeInfo): DiagnosticsService {
        const userData = app.getPath("userData");
        return new DiagnosticsService(
            {
                appData: app.getPath("appData"),
                configuration: join(userData, "config"),
                crashDumps: app.getPath("crashDumps"),
                logs: app.getPath("logs"),
                sessionData: app.getPath("sessionData"),
                userData,
            },
            runtime,
        );
    }

    async initialize(): Promise<void> {
        await Promise.all([
            mkdir(this.paths.configuration, { recursive: true, mode: 0o700 }),
            mkdir(this.paths.crashDumps, { recursive: true, mode: 0o700 }),
            mkdir(this.paths.logs, { recursive: true, mode: 0o700 }),
        ]);
        await this.appendLog("diagnostics service initialized");
    }

    path(kind: DiagnosticPathKind): string {
        if (kind === "logs") return this.paths.logs;
        if (kind === "settings") return this.paths.userData;
        if (kind === "caches") return this.paths.sessionData;
        if (kind === "crashDumps") return this.paths.crashDumps;
        if (kind === "customProperties") {
            return this.configurationPath("customProperties");
        }
        return this.configurationPath("vmOptions");
    }

    async preparePath(kind: DiagnosticPathKind): Promise<string> {
        const path = this.path(kind);
        if (kind === "customProperties" || kind === "vmOptions") {
            const configurationKind =
                kind === "customProperties" ? "customProperties" : "vmOptions";
            try {
                await lstat(path);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                    throw error;
                }
                await this.writeConfiguration(
                    configurationKind,
                    defaultConfiguration(configurationKind),
                );
            }
            return path;
        }
        await mkdir(path, { recursive: true, mode: 0o700 });
        return path;
    }

    async snapshot(): Promise<DiagnosticSnapshot> {
        const processes = app.getAppMetrics().map((metric) => ({
            pid: metric.pid,
            type: metric.name || metric.type,
            cpuPercent: Math.max(0, metric.cpu.percentCPUUsage),
            memoryBytes: Math.max(
                0,
                Math.round(metric.memory.workingSetSize * 1_024),
            ),
        }));
        return DiagnosticSnapshotSchema.parse({
            capturedAt: new Date().toISOString(),
            uptimeSeconds: process.uptime(),
            processes,
        });
    }

    async readConfiguration(
        kind: DiagnosticConfigurationKind,
    ): Promise<string> {
        const path = this.configurationPath(kind);
        try {
            const metadata = await lstat(path);
            if (metadata.isSymbolicLink() || !metadata.isFile()) {
                throw new Error("Configuration target must be a regular file.");
            }
            if (metadata.size > MAX_CONFIGURATION_BYTES) {
                throw new Error("Configuration file exceeds 1 MiB.");
            }
            return readFile(path, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            return defaultConfiguration(kind);
        }
    }

    async writeConfiguration(
        kind: DiagnosticConfigurationKind,
        content: string,
    ): Promise<void> {
        await mkdir(this.paths.configuration, {
            recursive: true,
            mode: 0o700,
        });
        const path = this.configurationPath(kind);
        try {
            const metadata = await lstat(path);
            if (metadata.isSymbolicLink() || !metadata.isFile()) {
                throw new Error("Configuration target must be a regular file.");
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        await writeFile(path, validateConfiguration(kind, content), {
            encoding: "utf8",
            mode: 0o600,
        });
        await this.appendLog(`updated ${configurationFileName(kind)}`);
    }

    async createLogArchive(
        settings: Readonly<Record<string, JsonValue>>,
    ): Promise<Uint8Array> {
        await mkdir(this.paths.logs, { recursive: true, mode: 0o700 });
        const entries: Record<string, Uint8Array> = {};
        let totalBytes = 0;
        for (const entry of await readdir(this.paths.logs, {
            withFileTypes: true,
        })) {
            if (!entry.isFile()) continue;
            const path = join(this.paths.logs, entry.name);
            const metadata = await lstat(path);
            if (metadata.isSymbolicLink()) continue;
            totalBytes += metadata.size;
            if (totalBytes > MAX_LOG_ARCHIVE_INPUT_BYTES) {
                throw new Error("Diagnostic logs exceed the 32 MiB archive limit.");
            }
            entries[`logs/${basename(entry.name)}`] = await readFile(path);
        }
        const safeSettings = Object.fromEntries(
            Object.entries(settings).filter(
                ([key]) => !key.startsWith(CREDENTIAL_PREFIX),
            ),
        );
        entries["diagnostics.json"] = strToU8(
            `${JSON.stringify(
                {
                    runtime: this.runtime,
                    snapshot: await this.snapshot(),
                    collectedAt: new Date().toISOString(),
                },
                null,
                2,
            )}\n`,
        );
        entries["settings.json"] = strToU8(
            `${JSON.stringify(safeSettings, null, 2)}\n`,
        );
        return zipSync(entries, { level: 9 });
    }

    async dumpThreads(): Promise<string> {
        await mkdir(this.paths.logs, { recursive: true, mode: 0o700 });
        const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
        const path = join(this.paths.logs, `thread-dump-${stamp}.json`);
        const report = process.report?.getReport();
        const safeReport = {
            javascriptStack: reportSection(report, "javascriptStack"),
            nativeStack: reportSection(report, "nativeStack"),
            resourceUsage: reportSection(report, "resourceUsage"),
            uvthreadResourceUsage: reportSection(
                report,
                "uvthreadResourceUsage",
            ),
            libuv: reportSection(report, "libuv"),
            workers: reportSection(report, "workers"),
        };
        await writeFile(
            path,
            `${JSON.stringify(
                {
                    capturedAt: new Date().toISOString(),
                    runtime: this.runtime,
                    report: safeReport,
                    processes: app.getAppMetrics(),
                },
                null,
                2,
            )}\n`,
            { encoding: "utf8", mode: 0o600 },
        );
        await this.appendLog(`thread dump written to ${basename(path)}`);
        return path;
    }

    async createKeyboardShortcutsPdf(): Promise<string> {
        const target = join(
            this.paths.userData,
            "Git Client Keyboard Shortcuts.pdf",
        );
        const preview = new BrowserWindow({
            show: false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
            },
        });
        try {
            await preview.loadURL(
                `data:text/html;charset=utf-8,${encodeURIComponent(shortcutDocument())}`,
            );
            const bytes = await preview.webContents.printToPDF({
                pageSize: "A4",
                printBackground: true,
            });
            await writeFile(target, bytes, { mode: 0o600 });
        } finally {
            preview.destroy();
        }
        return target;
    }

    async listLeftoverDirectories(): Promise<
        readonly DiagnosticLeftoverDirectory[]
    > {
        const parent = await realpath(this.paths.appData);
        const current = await realpath(this.paths.userData);
        const leftovers: DiagnosticLeftoverDirectory[] = [];
        for (const entry of await readdir(parent, { withFileTypes: true })) {
            if (
                leftovers.length >= MAX_LEFTOVER_DIRECTORIES ||
                !entry.isDirectory() ||
                entry.name === ELECTRON_PROFILE_PREFIX ||
                !entry.name.startsWith(ELECTRON_PROFILE_PREFIX) ||
                !LEFTOVER_PROFILE_NAME.test(entry.name)
            ) {
                continue;
            }
            const candidate = join(parent, entry.name);
            const metadata = await lstat(candidate);
            if (metadata.isSymbolicLink() || !metadata.isDirectory()) continue;
            const canonical = await realpath(candidate);
            if (canonical === current || dirname(canonical) !== parent) continue;
            leftovers.push({
                id: entry.name,
                name: entry.name,
                lastModifiedMs: Math.max(0, Math.round(metadata.mtimeMs)),
                sizeBytes: await directorySize(canonical),
            });
        }
        return leftovers.sort(
            (left, right) => right.lastModifiedMs - left.lastModifiedMs,
        );
    }

    async deleteLeftoverDirectories(
        ids: readonly string[],
    ): Promise<readonly string[]> {
        const available = new Map(
            (await this.listLeftoverDirectories()).map((entry) => [
                entry.id,
                entry,
            ]),
        );
        const parent = await realpath(this.paths.appData);
        const current = await realpath(this.paths.userData);
        const deleted: string[] = [];
        for (const id of ids) {
            if (!available.has(id) || !LEFTOVER_PROFILE_NAME.test(id)) {
                throw new Error(
                    "The selected leftover profile is no longer available.",
                );
            }
            const candidate = join(parent, id);
            const metadata = await lstat(candidate);
            if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
                throw new Error(
                    "Leftover profile deletion refuses symbolic links and non-directories.",
                );
            }
            const canonical = await realpath(candidate);
            if (canonical === current || dirname(canonical) !== parent) {
                throw new Error("The active profile cannot be deleted.");
            }
            await rm(canonical, {
                recursive: true,
                force: false,
                maxRetries: 2,
                retryDelay: 50,
            });
            deleted.push(id);
            await this.appendLog(`deleted leftover Electron profile ${id}`);
        }
        return deleted;
    }

    private configurationPath(kind: DiagnosticConfigurationKind): string {
        return join(this.paths.configuration, configurationFileName(kind));
    }

    private async appendLog(message: string): Promise<void> {
        await mkdir(this.paths.logs, { recursive: true, mode: 0o700 });
        await appendFile(
            join(this.paths.logs, "git-client.log"),
            `${new Date().toISOString()} ${message}\n`,
            { encoding: "utf8", mode: 0o600 },
        );
    }
}
