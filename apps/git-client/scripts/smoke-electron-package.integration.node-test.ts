import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, it } from "node:test";
import {
    HANDSHAKE_SENTINEL,
    READY_SENTINEL,
    createSmokeTimeoutFailure,
    detectSmokeLogFailure,
    isSmokeStartupReady,
    terminateSmokeChild,
    validateSmokeOutcome,
} from "./smoke-electron-package.ts";

const HEALTHY_OUTPUT = `${READY_SENTINEL}\n${HANDSHAKE_SENTINEL}\n`;

void describe("packaged Electron smoke outcome", () => {
    void it("requires both renderer readiness and a live preload API handshake", () => {
        assert.deepEqual(
            validateSmokeOutcome({
                code: 0,
                signal: null,
                output: HEALTHY_OUTPUT,
                handshakeComplete: true,
            }),
            { ready: true, preloadApi: true, exitCode: 0 },
        );

        assert.throws(
            () =>
                validateSmokeOutcome({
                    code: 0,
                    signal: null,
                    output: `${READY_SENTINEL}\n`,
                    handshakeComplete: false,
                }),
            /without a renderer\/preload API handshake/iu,
        );
        assert.throws(
            () =>
                validateSmokeOutcome({
                    code: 0,
                    signal: null,
                    output: `${READY_SENTINEL}\n`,
                    handshakeComplete: true,
                }),
            /without a renderer\/preload API handshake/iu,
        );
    });

    void it("recognizes preload, module resolution, renderer, uncaught, and fatal failures", () => {
        const fixtures = [
            [
                "preload load failure",
                "Unable to load preload script: /app/preload.cjs",
            ],
            [
                "preload load failure",
                "Preload script startup failed before context bridge exposure",
            ],
            [
                "preload load failure",
                "Error loading preload script before navigation",
            ],
            ["module-not-found", "Error: module not found: node:crypto"],
            [
                "module-not-found",
                "Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'missing'",
            ],
            ["renderer load failure", "[git-client] renderer load failed"],
            ["renderer load failure", "did-fail-load: ERR_FILE_NOT_FOUND"],
            ["uncaught startup error", "Uncaught Exception: startup exploded"],
            ["uncaught startup error", "Uncaught TypeError: startup exploded"],
            [
                "uncaught startup error",
                "Unhandled Promise Rejection at startup",
            ],
            [
                "uncaught startup error",
                "UnhandledPromiseRejectionWarning: startup exploded",
            ],
            ["fatal startup error", "[git-client] startup failed"],
            ["fatal startup error", "[git-client] window startup failed"],
            ["fatal startup error", "FATAL: renderer initialization failed"],
            [
                "fatal startup error",
                "FATAL ERROR: renderer initialization failed",
            ],
        ];

        for (const [expected, fixture] of fixtures) {
            assert.equal(detectSmokeLogFailure(fixture), expected);
            assert.throws(
                () =>
                    validateSmokeOutcome({
                        code: 0,
                        signal: null,
                        output: `${HEALTHY_OUTPUT}${fixture}\n`,
                        handshakeComplete: true,
                    }),
                new RegExp(`Packaged app logged ${expected}`, "u"),
            );
        }
    });

    void it("still rejects abnormal exits and missing renderer readiness", () => {
        assert.throws(
            () =>
                validateSmokeOutcome({
                    code: 1,
                    signal: null,
                    output: HEALTHY_OUTPUT,
                    handshakeComplete: true,
                }),
            /exited unexpectedly/iu,
        );
        assert.throws(
            () =>
                validateSmokeOutcome({
                    code: 0,
                    signal: null,
                    output: HANDSHAKE_SENTINEL,
                    handshakeComplete: true,
                }),
            /before its renderer loaded/iu,
        );
        assert.throws(
            () =>
                validateSmokeOutcome({
                    code: 0,
                    signal: null,
                    output: HEALTHY_OUTPUT,
                    handshakeComplete: true,
                    observedFailure: "module-not-found",
                }),
            /Packaged app logged module-not-found/iu,
        );
    });

    void it("accepts a controlled cleanup only after readiness and handshake", () => {
        assert.equal(isSmokeStartupReady(HEALTHY_OUTPUT, true), true);
        assert.equal(isSmokeStartupReady(HANDSHAKE_SENTINEL, true), false);
        assert.equal(isSmokeStartupReady(HEALTHY_OUTPUT, false), false);
        assert.deepEqual(
            validateSmokeOutcome({
                code: null,
                signal: "SIGKILL",
                output: HEALTHY_OUTPUT,
                handshakeComplete: true,
                controlledCleanup: true,
            }),
            { ready: true, preloadApi: true, exitCode: 0 },
        );
        assert.throws(
            () =>
                validateSmokeOutcome({
                    code: null,
                    signal: "SIGKILL",
                    output: HANDSHAKE_SENTINEL,
                    handshakeComplete: true,
                    controlledCleanup: true,
                }),
            /before its renderer loaded/iu,
        );
    });

    void it("retains captured startup output in timeout failures", () => {
        const failure = createSmokeTimeoutFailure(
            "startup diagnostic\n",
            "SIGKILL",
        );
        assert.match(failure.message, /cleanup=SIGKILL/iu);
        assert.match(failure.message, /startup diagnostic/iu);
    });

    void it(
        "force-stops a packaged process that ignores graceful termination",
        { skip: process.platform === "win32" },
        async () => {
            const child = spawn(
                process.execPath,
                [
                    "-e",
                    "process.on('SIGTERM', () => undefined); process.stdout.write('ready\\n'); setInterval(() => undefined, 1000);",
                ],
                { stdio: ["ignore", "pipe", "ignore"] },
            );
            await once(child.stdout, "data");

            const cleanup = await terminateSmokeChild(child, {
                terminationGraceMs: 50,
                forceTerminationGraceMs: 1_000,
            });

            assert.equal(cleanup, "SIGKILL");
            assert.equal(child.signalCode, "SIGKILL");
            assert.deepEqual(
                validateSmokeOutcome({
                    code: child.exitCode,
                    signal: child.signalCode,
                    output: HEALTHY_OUTPUT,
                    handshakeComplete: true,
                    controlledCleanup: true,
                }),
                { ready: true, preloadApi: true, exitCode: 0 },
            );
        },
    );
});
