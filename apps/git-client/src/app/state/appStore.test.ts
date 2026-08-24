import { describe, expect, it } from "vitest";
import { createAppStore } from "./appStore";

describe("앱 스토어", () => {
  it("[성공] 앱을 제외된 상태로 유지하고 기능적 작업을 지원함", () => {
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
