import { describe, expect, test } from "vitest";
import { mapCaptionTrack, type CaptionTrackLike } from "./caption-translation";
import {
  runPrioritizedCaptionTranslationPipeline,
  selectPrioritizedCaptionWindow,
} from "./caption-priority-translation";
import { DEFAULT_LOCAL_TRANSLATION_SETTINGS } from "./local-translation";

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

describe("prioritized caption translation", () => {
  test("prioritizes active and upcoming cues around playback time", () => {
    const window = selectPrioritizedCaptionWindow(mapCaptionTrack(trackWithCues(8)), {
      currentTimeSeconds: 22,
      initialCueCount: 2,
      visibleCueCount: 5,
    });

    expect(window.initialTrack.cues.map((cue) => cue.id)).toEqual(["cue-2", "cue-3"]);
    expect(window.visibleTrack.cues.map((cue) => cue.id)).toEqual([
      "cue-2",
      "cue-3",
      "cue-4",
      "cue-5",
      "cue-6",
    ]);
  });

  test("publishes original captions before translating priority and background chunks", async () => {
    const requests: Array<readonly string[]> = [];
    const snapshots: Array<{
      readonly translated: readonly string[];
      readonly completed: number;
      readonly total: number;
    }> = [];

    const result = await runPrioritizedCaptionTranslationPipeline(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        targetLanguage: "ko-en",
        cacheEnabled: false,
      },
      trackWithCues(8),
      {
        currentTimeSeconds: 22,
        initialCueCount: 2,
        visibleCueCount: 5,
        initialBatchSize: 2,
        backgroundBatchSize: 3,
        fetcher: async (_input, init) => {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
          const texts = Array.isArray(body.q) ? body.q : [];
          requests.push(texts);
          return new Response(
            JSON.stringify({
              translatedText: texts.map((text: string) => `ko:${text}`),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
        onSnapshot: (snapshot) => {
          snapshots.push({
            translated: snapshot.displayCues.flatMap((cue) =>
              cue.translatedText ? [cue.id] : [],
            ),
            completed: snapshot.jobResult.progress.completed,
            total: snapshot.jobResult.progress.total,
          });
        },
      },
    );

    expect(requests).toEqual([
      ["Cue 2", "Cue 3"],
      ["Cue 4", "Cue 5", "Cue 6"],
    ]);
    expect(snapshots).toEqual([
      { translated: [], completed: 0, total: 5 },
      { translated: ["cue-2", "cue-3"], completed: 2, total: 5 },
      {
        translated: ["cue-2", "cue-3", "cue-4", "cue-5", "cue-6"],
        completed: 5,
        total: 5,
      },
    ]);
    expect(result.jobResult.status).toBe("succeeded");
  });
});
