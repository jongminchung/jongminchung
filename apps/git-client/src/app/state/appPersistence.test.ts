import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRODUCT_SETTINGS } from "../../domain/productSettings";
import {
  hydrateProductSettings,
  hydrateProjectDefaults,
} from "./appPersistence";

const electronSettings = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
}));

vi.mock("../../platform/electronSettings", () => ({
  readElectronSetting: electronSettings.read,
  writeElectronSettings: electronSettings.write,
}));

describe("앱을 활용해 주셔서 감사함", () => {
  beforeEach(() => {
    electronSettings.read.mockReset();
    electronSettings.write.mockReset();
  });

  it("[성공] 기존의 기록 보관소 설정을 수화함", async () => {
    electronSettings.read.mockResolvedValue({
      compactMode: true,
      zoom: 150,
    });

    await expect(hydrateProductSettings()).resolves.toMatchObject({
      compactMode: true,
      zoom: 150,
    });
  });

  it("[실패] 설정 키를 변경하지 않고 반대하는 프로젝트를 마이그레이션함", async () => {
    electronSettings.read.mockResolvedValue(undefined);

    await expect(hydrateProjectDefaults()).resolves.toMatchObject({
      settings: DEFAULT_PRODUCT_SETTINGS,
      appearance: { theme: "dark", syncWithOs: false },
    });
    expect(electronSettings.read).toHaveBeenCalledWith(
      "newProjectProductSettings",
    );
    expect(electronSettings.read).toHaveBeenCalledWith(
      "newProjectAppearanceMode",
    );
    expect(electronSettings.read).toHaveBeenCalledWith(
      "runConfigurationTemplates",
    );
  });
});
