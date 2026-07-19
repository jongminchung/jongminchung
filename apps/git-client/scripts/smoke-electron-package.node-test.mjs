import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    HANDSHAKE_SENTINEL,
    READY_SENTINEL,
    detectSmokeLogFailure,
    validateSmokeOutcome,
} from "./smoke-electron-package.mjs";

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
});
