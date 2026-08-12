import { describe, expect, it } from "vitest";
import { createAppStore } from "./appStore";

describe("AppStore", () => {
    it("keeps app instances isolated and supports functional actions", () => {
        const first = createAppStore();
        const second = createAppStore();

        first.getState().setSettingsOpen(true);
        first.getState().setDirtyEditorCount((count) => count + 2);

        expect(first.getState().settingsOpen).toBe(true);
        expect(first.getState().dirtyEditorCount).toBe(2);
        expect(second.getState().settingsOpen).toBe(false);
        expect(second.getState().dirtyEditorCount).toBe(0);
    });
});
