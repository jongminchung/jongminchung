import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hydrateRepositoryBookmarks,
  hydrateRepositoryUiState,
} from "./repositoryWorkspacePersistence";

const electronSettings = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
}));

vi.mock("../../../application/desktop/DesktopPort", () => ({
  readDesktopSetting: electronSettings.read,
  writeDesktopSettings: electronSettings.write,
}));

describe("용도를 변경하여 사용하세요", () => {
  beforeEach(() => {
    electronSettings.read.mockReset();
    electronSettings.write.mockReset();
  });

  it("[성공] 기존 위치에 보관되어 있는 UI 상태를 마이그레이션함", async () => {
    electronSettings.read.mockResolvedValue({ bottomPanelHeight: 10_000 });

    await expect(
      hydrateRepositoryUiState("repository-1"),
    ).resolves.toMatchObject({
      bottomPanelHeight: 420,
      activeView: "history",
    });
    expect(electronSettings.read).toHaveBeenCalledWith(
      "repositoryUiState:repository-1",
    );
  });

  it("[성공] 기존 파서 및 키로 북마크를 수화함", async () => {
    electronSettings.read.mockResolvedValue(undefined);

    const bookmarks = await hydrateRepositoryBookmarks(
      "repository-1",
      "Example",
    );

    expect(bookmarks.schemaVersion).toBe(1);
    expect(bookmarks.groups[0]?.name).toBe("Example");
    expect(electronSettings.read).toHaveBeenCalledWith(
      "repositoryBookmarks:repository-1",
    );
  });
});
