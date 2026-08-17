import { describe, expect, it } from "vitest";
import { containsNodeBuiltinImport } from "./vite.preload.config";

describe("샌드박스 사전 바인딩 경계", () => {
    it.each([
        'const crypto = require("node:crypto")',
        "const fs = require( 'node:fs/promises')",
        'const bareBuiltin = require("fs")',
        'const module = import("node:module")',
    ])("[실패] 유닛이 가져오기를 수행합니다: %s", (code) => {
        expect(containsNodeBuiltinImport(code)).toBe(true);
    });

    it("[성공] Electron 및 브라우저 API를 승인함", () => {
        expect(
            containsNodeBuiltinImport(
                'const { contextBridge } = require("electron"); globalThis.crypto.randomUUID();',
            ),
        ).toBe(false);
    });
});
