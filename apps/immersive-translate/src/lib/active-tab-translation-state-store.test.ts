import { describe, expect, test } from "vitest";
import {
  ACTIVE_TAB_CAPTION_IDLE_STATE,
  ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE,
  ACTIVE_TAB_WEBPAGE_IDLE_STATE,
} from "./active-tab-translation";
import { ActiveTabTranslationStateStore } from "./active-tab-translation-state-store";

describe("ActiveTabTranslationStateStore", () => {
  test("stores per-tab status and clears all tab-owned resources", () => {
    const store = ActiveTabTranslationStateStore.create();
    const captionController = new AbortController();
    const generatedCaptionController = new AbortController();
    const webpageController = new AbortController();

    store.markBridgeReady(12);
    store.setLastError(12, "Previous failure");
    store.setCaptionState(12, ACTIVE_TAB_CAPTION_IDLE_STATE);
    store.setGeneratedCaptionState(12, ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE);
    store.setWebpageState(12, ACTIVE_TAB_WEBPAGE_IDLE_STATE);
    store.setCaptionController(12, captionController);
    store.setGeneratedCaptionController(12, generatedCaptionController);
    store.setWebpageController(12, webpageController);

    expect(store.isBridgeReady(12)).toBe(true);
    expect(store.getLastError(12)).toBe("Previous failure");
    expect(store.getCaptionState(12)).toBe(ACTIVE_TAB_CAPTION_IDLE_STATE);
    expect(store.getGeneratedCaptionState(12)).toBe(ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE);
    expect(store.getWebpageState(12)).toBe(ACTIVE_TAB_WEBPAGE_IDLE_STATE);
    expect(store.activeWebpageControllerTabIds()).toEqual([12]);

    store.clearTab(12);

    expect(captionController.signal.aborted).toBe(true);
    expect(generatedCaptionController.signal.aborted).toBe(true);
    expect(webpageController.signal.aborted).toBe(true);
    expect(store.isBridgeReady(12)).toBe(false);
    expect(store.getLastError(12)).toBeNull();
    expect(store.getCaptionState(12)).toBeNull();
    expect(store.getGeneratedCaptionState(12)).toBeNull();
    expect(store.getWebpageState(12)).toBeNull();
    expect(store.getCaptionController(12)).toBeNull();
    expect(store.getGeneratedCaptionController(12)).toBeNull();
    expect(store.getWebpageController(12)).toBeNull();
    expect(store.activeWebpageControllerTabIds()).toEqual([]);
  });

  test("returns aborted controllers when cancelling individual pipelines", () => {
    const store = ActiveTabTranslationStateStore.create();
    const controller = new AbortController();

    store.setWebpageController(7, controller);

    expect(store.abortWebpageController(7)).toBe(controller);
    expect(controller.signal.aborted).toBe(true);
    expect(store.getWebpageController(7)).toBeNull();
    expect(store.abortWebpageController(7)).toBeNull();
  });
});
