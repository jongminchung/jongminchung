import { describe, expect, it } from "vitest";
import { containsNodeBuiltinImport } from "./vite.preload.config";

describe("sandboxed preload bundle boundary", () => {
  it.each([
    'const crypto = require("node:crypto")',
    "const fs = require( 'node:fs/promises')",
    'const bareBuiltin = require("fs")',
    'const module = import("node:module")',
  ])("rejects a Node built-in import: %s", (code) => {
    expect(containsNodeBuiltinImport(code)).toBe(true);
  });

  it("allows Electron and browser APIs", () => {
    expect(
      containsNodeBuiltinImport(
        'const { contextBridge } = require("electron"); globalThis.crypto.randomUUID();',
      ),
    ).toBe(false);
  });
});
