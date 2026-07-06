import { describe, expect, test } from "vitest";
import type { CaptionTrackLike } from "./caption-translation";
import { selectInitialCaptionWindow } from "./youtube-captions";

function trackWithCues(count: number): CaptionTrackLike {
  return {
    id: "youtube",
    label: "English",
    source: { platform: "youtube", trackId: "en" },
    cues: Array.from({ length: count }, (_, index) => ({
      id: `cue-${index}`,
      text: `Cue ${index}`,
      startTimeSeconds: index * 10,
      endTimeSeconds: index * 10 + 5,
    })),
  };
}

describe("selectInitialCaptionWindow", () => {
  test("selects cues around the current video time", () => {
    const selected = selectInitialCaptionWindow(trackWithCues(12), {
      currentTimeSeconds: 42,
      maxCueCount: 4,
    });

    expect(selected.cues.map((cue) => cue.id)).toEqual(["cue-2", "cue-3", "cue-4", "cue-5"]);
  });

  test("falls back to the first cues when current time is unavailable", () => {
    const selected = selectInitialCaptionWindow(trackWithCues(12), { maxCueCount: 4 });

    expect(selected.cues.map((cue) => cue.id)).toEqual(["cue-0", "cue-1", "cue-2", "cue-3"]);
  });
});
