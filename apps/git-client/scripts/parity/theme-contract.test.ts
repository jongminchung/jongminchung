import { describe, expect, test } from "vitest";
import {
  loadThemeParityContract,
  resolveThemeColors,
  verifyThemeContract,
} from "./theme-contract.mjs";

describe("Rebased theme parity contract", () => {
  test("pins two source themes, their semantic roles, and approved goldens", () => {
    expect(verifyThemeContract()).toEqual({ goldens: 4, themes: 2, tokens: 32 });
  });

  test("resolves every source role to an sRGB color", () => {
    const resolved = resolveThemeColors(loadThemeParityContract());
    for (const theme of Object.values(resolved)) {
      for (const color of Object.values(theme))
        expect(color).toMatch(/^(?:#[\da-f]{6,8}|transparent)$/iu);
    }
  });
});
