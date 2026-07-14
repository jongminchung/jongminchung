import { describe, expect, it, vi } from "vitest";
import {
  createInjectedTranslationUiStore,
  parseInjectedTranslationUiEvent,
} from "./injected-ui-events";

describe("injected translation UI events", () => {
  it("parses JSON events and publishes immutable state updates", () => {
    const event = parseInjectedTranslationUiEvent(
      JSON.stringify({
        version: 1,
        type: "floating",
        state: {
          status: "active",
          active: true,
          message: "페이지 번역이 켜져 있습니다.",
        },
      }),
    );
    expect(event).not.toBeNull();

    const store = createInjectedTranslationUiStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    if (event) store.receive(event);

    expect(store.getSnapshot().floating).toEqual({
      status: "active",
      active: true,
      message: "페이지 번역이 켜져 있습니다.",
    });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("rejects malformed caption events", () => {
    expect(
      parseInjectedTranslationUiEvent({
        version: 1,
        type: "caption-cue",
        message: "invalid",
        cue: { id: "cue-1", lines: "not-an-array" },
      }),
    ).toBeNull();
    expect(parseInjectedTranslationUiEvent("not-json")).toBeNull();
  });
});
