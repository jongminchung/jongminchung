#!/usr/bin/env node
// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.

import { spawn } from "node:child_process";
import { once } from "node:events";
import { lstat, realpath } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePackagedAppPath } from "./packaged-app-path.ts";

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
const TERMINATION_GRACE_MS = 1_000;
const FORCE_TERMINATION_GRACE_MS = 1_000;
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

function appendLog(current: any, chunk: any) {
    const next = `${current}${chunk}`;
    return next.length <= MAX_LOG_CHARACTERS
        ? next
        : next.slice(-MAX_LOG_CHARACTERS);
}

function childExited(child: any) {
    return child.exitCode !== null || child.signalCode !== null;
}

function waitForChildClose(child: any, timeoutMs: any) {
    if (childExited(child)) return Promise.resolve(true);
    return new Promise((resolveWait: any) => {
        const onClose = () => {
            clearTimeout(timeout);
            resolveWait(true);
        };
        const timeout = setTimeout(() => {
            child.off("close", onClose);
            resolveWait(false);
        }, timeoutMs);
        child.once("close", onClose);
    });
}

export async function terminateSmokeChild(
    child: any,
    {
        terminationGraceMs = TERMINATION_GRACE_MS,
        forceTerminationGraceMs = FORCE_TERMINATION_GRACE_MS,
    }: any = {},
) {
    if (childExited(child)) return "already-exited";
    child.kill("SIGTERM");
    if (await waitForChildClose(child, terminationGraceMs)) return "SIGTERM";
    child.kill("SIGKILL");
    if (await waitForChildClose(child, forceTerminationGraceMs))
        return "SIGKILL";

    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
    throw new Error("Packaged app remained alive after SIGKILL");
}

export function createSmokeTimeoutFailure(output: any, cleanup: any) {
    const captured = output.length === 0 ? "<no output captured>" : output;
    return new Error(
        `Packaged app did not finish its startup smoke test within ${TIMEOUT_MS}ms (cleanup=${cleanup})\nCaptured output:\n${captured}`,
    );
}

export function isSmokeStartupReady(output: any, handshakeComplete: any) {
    return (
        handshakeComplete &&
        output.includes(READY_SENTINEL) &&
        output.includes(HANDSHAKE_SENTINEL)
    );
}

export function detectSmokeLogFailure(output: any) {
    if (typeof output !== "string")
        throw new TypeError("Smoke output must be a string");
    return (
        FAILURE_PATTERNS.find(({ pattern }: any) => pattern.test(output))
            ?.label ?? null
    );
}

export function validateSmokeOutcome({
    code,
    signal,
    output,
    handshakeComplete,
    observedFailure = null,
    controlledCleanup = false,
}: any) {
    const failure = observedFailure ?? detectSmokeLogFailure(output);
    if (failure !== null) {
        throw new Error(`Packaged app logged ${failure}\n${output}`);
    }
    if (!controlledCleanup && (code !== 0 || signal !== null)) {
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
    return Object.freeze({
        ready: true,
        preloadApi: true,
        exitCode: controlledCleanup ? 0 : code,
    });
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

function delay(milliseconds: any, signal: any) {
    return new Promise((resolveDelay: any, rejectDelay: any) => {
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

async function cdpTargets(port: any, signal: any) {
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
    return value.flatMap((candidate: any) => {
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

function evaluateHandshake(webSocketDebuggerUrl: any, signal: any) {
    return new Promise((resolveHandshake: any, rejectHandshake: any) => {
        const socket = new WebSocket(webSocketDebuggerUrl);
        let settled = false;
        const finish = (error: any, value: any) => {
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
        socket.addEventListener("message", (event: any) => {
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
            {
                once: true,
            },
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

async function probeRendererPreloadApi(port: any, signal: any) {
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (signal.aborted) throw abortError();
        try {
            const targets = await cdpTargets(port, signal);
            const ordered = [...targets].sort(
                (left: any, right: any) =>
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

export async function smokeElectronPackage(inputPath: any) {
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
    return new Promise((resolveResult: any, rejectResult: any) => {
        const child = spawn(
            executablePath,
            [
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
        let observedFailure: any = null;
        let settled = false;
        let stopping = false;
        let handshakeComplete = false;
        const handshakeController = new AbortController();
        let timeout: any = null;
        const finish = (error: unknown, result?: any) => {
            if (settled) return;
            settled = true;
            if (timeout !== null) clearTimeout(timeout);
            if (error === null) resolveResult(result);
            else rejectResult(error);
        };
        const stopAndValidate = (controlledCleanup: any) => {
            if (settled || stopping) return;
            stopping = true;
            handshakeController.abort();
            void terminateSmokeChild(child).then(
                (cleanup: any) => {
                    try {
                        const result = validateSmokeOutcome({
                            code: child.exitCode,
                            signal: child.signalCode,
                            output,
                            handshakeComplete,
                            observedFailure,
                            controlledCleanup:
                                controlledCleanup &&
                                cleanup !== "already-exited",
                        });
                        finish(null, Object.freeze({ appPath, ...result }));
                    } catch (error) {
                        finish(error);
                    }
                },
                (error: any) => finish(error),
            );
        };
        const maybeStop = () => {
            if (observedFailure !== null) {
                stopAndValidate(false);
                return;
            }
            if (isSmokeStartupReady(output, handshakeComplete))
                stopAndValidate(true);
        };
        const handshake = probeRendererPreloadApi(
            remoteDebuggingPort,
            handshakeController.signal,
        )
            .then(() => {
                handshakeComplete = true;
                output = appendLog(output, `${HANDSHAKE_SENTINEL}\n`);
                maybeStop();
            })
            .catch(() => undefined);
        timeout = setTimeout(() => {
            if (settled || stopping) return;
            stopping = true;
            handshakeController.abort();
            void terminateSmokeChild(child).then(
                (cleanup: any) =>
                    finish(createSmokeTimeoutFailure(output, cleanup)),
                (error: any) =>
                    finish(
                        createSmokeTimeoutFailure(
                            output,
                            `failed: ${error instanceof Error ? error.message : String(error)}`,
                        ),
                    ),
            );
        }, TIMEOUT_MS);

        const capture = (chunk: any) => {
            const text = chunk.toString("utf8");
            observedFailure ??= detectSmokeLogFailure(
                `${output.slice(-4_096)}${text}`,
            );
            output = appendLog(output, text);
            maybeStop();
        };
        child.stdout.on("data", capture);
        child.stderr.on("data", capture);
        child.once("error", (error: any) => {
            handshakeController.abort();
            if (stopping) return;
            stopping = true;
            if (child.pid === undefined) {
                finish(error);
                return;
            }
            void terminateSmokeChild(child).then(
                () => finish(error),
                (cleanupError: any) =>
                    finish(
                        new AggregateError(
                            [error, cleanupError],
                            "Packaged app failed and could not be stopped",
                        ),
                    ),
            );
        });
        child.once("close", (code: any, signal: any) => {
            if (stopping) return;
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
    const defaultAppPath = resolvePackagedAppPath({
        cwd: resolve(dirname(scriptPath), ".."),
    });
    const requestedPath =
        process.argv[2] === undefined
            ? defaultAppPath
            : resolve(process.argv[2]);
    smokeElectronPackage(requestedPath).then(
        (result: any) =>
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
        (error: any) => {
            process.stderr.write(
                `${error instanceof Error ? error.message : String(error)}\n`,
            );
            process.exitCode = 1;
        },
    );
}
