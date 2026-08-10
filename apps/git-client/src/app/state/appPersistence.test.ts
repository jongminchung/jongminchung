import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRODUCT_SETTINGS } from "../../domain/productSettings";
import { hydrateProductSettings, hydrateProjectDefaults } from "./appPersistence";

const electronSettings = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
}));

vi.mock("../../platform/electronSettings", () => ({
  readElectronSetting: electronSettings.read,
  writeElectronSettings: electronSettings.write,
}));

describe("app persistence adapter", () => {
  beforeEach(() => {
    electronSettings.read.mockReset();
    electronSettings.write.mockReset();
  });

  it("hydrates product settings through the existing parser", async () => {
    electronSettings.read.mockResolvedValue({ compactMode: true, zoom: 150 });

    await expect(hydrateProductSettings()).resolves.toMatchObject({
      compactMode: true,
      zoom: 150,
    });
  });

  it("migrates missing project defaults without changing their setting keys", async () => {
    electronSettings.read.mockResolvedValue(undefined);

    await expect(hydrateProjectDefaults()).resolves.toMatchObject({
      settings: DEFAULT_PRODUCT_SETTINGS,
      appearance: { theme: "dark", syncWithOs: false },
    });
    expect(electronSettings.read).toHaveBeenCalledWith("newProjectProductSettings");
    expect(electronSettings.read).toHaveBeenCalledWith("newProjectAppearanceMode");
    expect(electronSettings.read).toHaveBeenCalledWith("runConfigurationTemplates");
  });
});
