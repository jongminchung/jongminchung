import { describe, expect, test } from "vitest";
import { shouldAutoStartCaptionTranslation } from "./video-auto-activation";

describe("video auto caption activation", () => {
  test("starts only when local translation is enabled on a video page once per URL", () => {
    const readyStatus = {
      localTranslationState: "enabled" as const,
      captionState: { name: "idle" },
    };

    expect(
      shouldAutoStartCaptionTranslation({
        status: readyStatus,
        currentUrl: "https://www.youtube.com/watch?v=alpha",
        lastAutoCaptionUrl: null,
        hasVideoContext: true,
      }),
    ).toBe(true);
    expect(
      shouldAutoStartCaptionTranslation({
        status: readyStatus,
        currentUrl: "https://www.youtube.com/watch?v=alpha",
        lastAutoCaptionUrl: "https://www.youtube.com/watch?v=alpha",
        hasVideoContext: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoStartCaptionTranslation({
        status: readyStatus,
        currentUrl: "https://go.dev/doc/",
        lastAutoCaptionUrl: null,
        hasVideoContext: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoStartCaptionTranslation({
        status: { localTranslationState: "disabled", captionState: { name: "idle" } },
        currentUrl: "https://www.youtube.com/watch?v=alpha",
        lastAutoCaptionUrl: null,
        hasVideoContext: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoStartCaptionTranslation({
        status: { localTranslationState: "enabled", captionState: { name: "rendered" } },
        currentUrl: "https://www.youtube.com/watch?v=alpha",
        lastAutoCaptionUrl: null,
        hasVideoContext: true,
      }),
    ).toBe(false);
  });
});
