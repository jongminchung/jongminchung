import { describe, expect, it } from "vitest";
import { DEFAULT_PRODUCT_SETTINGS, parseProductSettings } from "./productSettings";

describe("product settings", () => {
  it("uses Rebased regular density and 100% zoom by default", () => {
    expect(parseProductSettings(null)).toEqual(DEFAULT_PRODUCT_SETTINGS);
  });

  it("accepts only supported compact, zoom, and notification values", () => {
    expect(parseProductSettings({ compactMode: true, zoom: 125, showNotifications: false })).toEqual({
      compactMode: true,
      ideFontSize: 13,
      zoom: 125,
      showNotifications: false,
      showShortcutConflictWarning: true,
      keymapPreset: "macOS",
      keymapOverrides: {},
    });
    expect(parseProductSettings({ compactMode: "yes", zoom: 110, showNotifications: 1 })).toEqual(DEFAULT_PRODUCT_SETTINGS);
  });

  it("accepts only bounded IDE font sizes", () => {
    expect(parseProductSettings({ ideFontSize: 16 }).ideFontSize).toBe(16);
    expect(parseProductSettings({ ideFontSize: 4 }).ideFontSize).toBe(13);
    expect(parseProductSettings({ ideFontSize: Number.NaN }).ideFontSize).toBe(13);
  });

  it("keeps only bounded shortcut overrides", () => {
    expect(parseProductSettings({
      keymapOverrides: {
        "view.project": "CmdOrCtrl+1",
        "view.notifications": null,
        tooLong: "x".repeat(129),
      },
    }).keymapOverrides).toEqual({
      "view.project": "CmdOrCtrl+1",
      "view.notifications": null,
    });
  });
});
