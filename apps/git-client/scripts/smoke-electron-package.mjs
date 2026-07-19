#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { lstat, realpath } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const READY_SENTINEL = "[git-client] packaged-smoke-ready";
export const HANDSHAKE_SENTINEL = "[git-client] smoke-preload-api-handshake";
const FAILURE_PATTERNS = Object.freeze([
    Object.freeze({
        label: "preload load failure",
        pattern:
            /(?:unable|failed|error)\s+(?:to\s+)?load(?:ing)?\s+preload(?: script)?|preload(?: script)?[^\r\n]*(?:failed|failure)/iu,
    }),
    Object.freeze({
        label: "module-not-found",
        pattern:
            /\b(?:cannot find module|module not found|(?:err_)?module_not_found)\b/iu,
    }),
    Object.freeze({
        label: "renderer load failure",
        pattern: /\[git-client\]\s*renderer load failed|\bdid-fail-load\b/iu,
    }),
    Object.freeze({
        label: "uncaught startup error",
        pattern:
            /\buncaught(?:\s+(?:exception|\w*error))?\b|\bunhandled(?:\s*promise)?\s*rejection(?:warning)?\b|a javascript error occurred in the main process/iu,
    }),
    Object.freeze({
        label: "fatal startup error",
        pattern:
            /\[git-client\]\s*(?:window\s+)?startup failed|\bfatal(?:\s+(?:startup\s+)?(?:error|exception)|:)/iu,
    }),
]);
const MAX_LOG_CHARACTERS = 1_000_000;
const TIMEOUT_MS = 20_000;
const HANDSHAKE_EXPRESSION = String.raw`(async () => {
  const api = globalThis.gitClient;
  if (typeof api !== "object" || api === null) return false;
  const methods = [
    api.runtime?.getInfo,
    api.settings?.get,
    api.dialog?.openDirectory,
    api.shell?.openExternal,
    api.clipboard?.writeText,
    api.menu?.onCommand,
    api.git?.openRepository,
    api.terminal?.create,
    api.hosting?.saveAccount,
  ];
  if (!methods.every((method) => typeof method === "function")) return false;
  const runtime = await api.runtime.getInfo();
  return runtime?.kind === "electron";
})()`;

function appendLog(current, chunk) {
    const next = `${current}${chunk}`;
    return next.length <= MAX_LOG_CHARACTERS
        ? next
        : next.slice(-MAX_LOG_CHARACTERS);
}

export function detectSmokeLogFailure(output) {
    if (typeof output !== "string")
        throw new TypeError("Smoke output must be a string");
    return (
        FAILURE_PATTERNS.find(({ pattern }) => pattern.test(output))?.label ??
        null
    );
}

export function validateSmokeOutcome({
    code,
    signal,
    output,
    handshakeComplete,
    observedFailure = null,
}) {
    const failure = observedFailure ?? detectSmokeLogFailure(output);
    if (failure !== null) {
        throw new Error(`Packaged app logged ${failure}\n${output}`);
    }
    if (code !== 0 || signal !== null) {
        throw new Error(
            `Packaged app smoke test exited unexpectedly (code=${String(code)}, signal=${String(signal)})\n${output}`,
        );
    }
    if (!output.includes(READY_SENTINEL)) {
        throw new Error(
            `Packaged app exited before its renderer loaded\n${output}`,
        );
    }
    if (!handshakeComplete || !output.includes(HANDSHAKE_SENTINEL)) {
        throw new Error(
            `Packaged app renderer became ready without a renderer/preload API handshake\n${output}`,
        );
    }
    return Object.freeze({ ready: true, preloadApi: true, exitCode: code });
}

async function freePort() {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
        server.close();
        throw new Error("Unable to reserve a packaged smoke CDP port");
    }
    const port = address.port;
    server.close();
    await once(server, "close");
    return port;
}

function abortError() {
    return new DOMException(
        "Renderer/preload handshake was cancelled",
        "AbortError",
    );
}

function delay(milliseconds, signal) {
    return new Promise((resolveDelay, rejectDelay) => {
        if (signal.aborted) {
            rejectDelay(abortError());
            return;
        }
        const onAbort = () => {
            clearTimeout(timeout);
            rejectDelay(abortError());
        };
        const timeout = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolveDelay();
        }, milliseconds);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

async function cdpTargets(port, signal) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal,
    });
    if (!response.ok)
        throw new Error(
            `CDP target discovery returned HTTP ${response.status}`,
        );
    const value = await response.json();
    if (!Array.isArray(value))
        throw new Error("CDP target discovery returned an invalid response");
    return value.flatMap((candidate) => {
        if (typeof candidate !== "object" || candidate === null) return [];
        const type = Reflect.get(candidate, "type");
        const url = Reflect.get(candidate, "url");
        const webSocketDebuggerUrl = Reflect.get(
            candidate,
            "webSocketDebuggerUrl",
        );
        if (
            type !== "page" ||
            typeof url !== "string" ||
            typeof webSocketDebuggerUrl !== "string"
        ) {
            return [];
        }
        return [{ url, webSocketDebuggerUrl }];
    });
}

function evaluateHandshake(webSocketDebuggerUrl, signal) {
    return new Promise((resolveHandshake, rejectHandshake) => {
        const socket = new WebSocket(webSocketDebuggerUrl);
        let settled = false;
        const finish = (error, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            signal.removeEventListener("abort", onAbort);
            try {
                socket.close();
            } catch {
                // A connection cancelled before its opening handshake cannot be closed.
            }
            if (error === null) resolveHandshake(value);
            else rejectHandshake(error);
        };
        const onAbort = () => finish(abortError(), false);
        const timeout = setTimeout(
            () => finish(new Error("CDP Runtime.evaluate timed out"), false),
            1_000,
        );
        signal.addEventListener("abort", onAbort, { once: true });
        socket.addEventListener(
            "open",
            () => {
                socket.send(
                    JSON.stringify({
                        id: 1,
                        method: "Runtime.evaluate",
                        params: {
                            awaitPromise: true,
                            expression: HANDSHAKE_EXPRESSION,
                            returnByValue: true,
                        },
                    }),
                );
            },
            { once: true },
        );
        socket.addEventListener("message", (event) => {
            if (typeof event.data !== "string") return;
            let message;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }
            if (message?.id !== 1) return;
            if (
                message.error !== undefined ||
                message.result?.exceptionDetails !== undefined
            ) {
                finish(
                    new Error(
                        "Renderer/preload API handshake evaluation failed",
                    ),
                    false,
                );
                return;
            }
            finish(null, message.result?.result?.value === true);
        });
        socket.addEventListener(
            "error",
            () => finish(new Error("CDP WebSocket failed"), false),
            { once: true },
        );
        socket.addEventListener(
            "close",
            () =>
                finish(
                    new Error("CDP WebSocket closed before the handshake"),
                    false,
                ),
            { once: true },
        );
    });
}

async function probeRendererPreloadApi(port, signal) {
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (signal.aborted) throw abortError();
        try {
            const targets = await cdpTargets(port, signal);
            const ordered = [...targets].sort(
                (left, right) =>
                    Number(right.url.startsWith("app://git-client/")) -
                    Number(left.url.startsWith("app://git-client/")),
            );
            for (const target of ordered) {
                if (
                    await evaluateHandshake(target.webSocketDebuggerUrl, signal)
                )
                    return;
            }
        } catch (error) {
            if (signal.aborted) throw error;
        }
        await delay(50, signal);
    }
    throw new Error("Renderer/preload API handshake timed out");
}

export async function smokeElectronPackage(inputPath) {
    if (process.platform !== "darwin") {
        throw new Error(
            "Packaged Electron smoke testing currently supports macOS only",
        );
    }
    if (
        typeof inputPath !== "string" ||
        !isAbsolute(inputPath) ||
        !inputPath.endsWith(".app")
    ) {
        throw new Error(
            "Packaged Electron smoke testing requires an absolute .app path",
        );
    }

    const appPath = await realpath(inputPath);
    const stat = await lstat(appPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`Packaged app is not a directory: ${appPath}`);
    }

    const executablePath = join(
        appPath,
        "Contents",
        "MacOS",
        basename(appPath, ".app"),
    );
    const remoteDebuggingPort = await freePort();
    return new Promise((resolveResult, rejectResult) => {
        const child = spawn(
            executablePath,
            [
                "--qa-isolated-profile",
                "--qa-smoke-test",
                "--enable-logging=stderr",
                "--remote-debugging-address=127.0.0.1",
                `--remote-debugging-port=${remoteDebuggingPort}`,
            ],
            {
                env: { ...process.env, ELECTRON_ENABLE_LOGGING: "1" },
                shell: false,
                stdio: ["ignore", "pipe", "pipe"],
            },
        );
        let output = "";
        let observedFailure = null;
        let settled = false;
        let handshakeComplete = false;
        const handshakeController = new AbortController();
        const handshake = probeRendererPreloadApi(
            remoteDebuggingPort,
            handshakeController.signal,
        )
            .then(() => {
                handshakeComplete = true;
                output = appendLog(output, `${HANDSHAKE_SENTINEL}\n`);
            })
            .catch(() => undefined);
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (error === null) resolveResult(result);
            else rejectResult(error);
        };
        const timeout = setTimeout(() => {
            handshakeController.abort();
            child.kill("SIGTERM");
            finish(
                new Error(
                    `Packaged app did not finish its startup smoke test within ${TIMEOUT_MS}ms`,
                ),
            );
        }, TIMEOUT_MS);

        const capture = (chunk) => {
            const text = chunk.toString("utf8");
            observedFailure ??= detectSmokeLogFailure(
                `${output.slice(-4_096)}${text}`,
            );
            output = appendLog(output, text);
        };
        child.stdout.on("data", capture);
        child.stderr.on("data", capture);
        child.once("error", (error) => {
            handshakeController.abort();
            finish(error);
        });
        child.once("close", (code, signal) => {
            handshakeController.abort();
            void handshake.then(() => {
                try {
                    const result = validateSmokeOutcome({
                        code,
                        signal,
                        output,
                        handshakeComplete,
                        observedFailure,
                    });
                    finish(null, Object.freeze({ appPath, ...result }));
                } catch (error) {
                    finish(error);
                }
            });
        });
    });
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath) {
    const defaultAppPath = resolve(
        dirname(scriptPath),
        "..",
        "out",
        "Git Client-darwin-arm64",
        "Git Client.app",
    );
    const requestedPath =
        process.argv[2] === undefined
            ? defaultAppPath
            : resolve(process.argv[2]);
    smokeElectronPackage(requestedPath).then(
        (result) =>
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
        (error) => {
            process.stderr.write(
                `${error instanceof Error ? error.message : String(error)}\n`,
            );
            process.exitCode = 1;
        },
    );
}
