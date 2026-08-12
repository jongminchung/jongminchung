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

describe("repository persistence adapter", () => {
    beforeEach(() => {
        electronSettings.read.mockReset();
        electronSettings.write.mockReset();
    });

    it("migrates repository UI state under the existing scoped key", async () => {
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

    it("hydrates bookmarks with the existing parser and key", async () => {
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
