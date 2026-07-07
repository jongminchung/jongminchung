import { describe, expect, test } from "vitest";
import { runCaptionTranslationPipeline, type CaptionTrackLike } from "./caption-translation";
import { DEFAULT_LOCAL_TRANSLATION_SETTINGS } from "./local-translation";

describe("caption translation pipeline", () => {
  test("requests opposite Korean/English targets for mixed caption lines", async () => {
    const requests: Array<{ readonly body: unknown }> = [];
    const track: CaptionTrackLike = {
      id: "mixed-captions",
      label: "Mixed captions",
      cues: [
        {
          id: "english-cue",
          text: "Hello from video captions",
          startTimeSeconds: 0,
          endTimeSeconds: 2,
        },
        {
          id: "korean-cue",
          text: "한국어 영상 자막입니다",
          startTimeSeconds: 2,
          endTimeSeconds: 4,
        },
      ],
    };

    const result = await runCaptionTranslationPipeline(
      {
        ...DEFAULT_LOCAL_TRANSLATION_SETTINGS,
        enabled: true,
        targetLanguage: "ko-en",
        batchSize: 10,
        cacheEnabled: false,
      },
      track,
      {
        fetcher: async (_input: string, init: RequestInit) => {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
          requests.push({ body });
          if (body?.target === "ko") {
            return new Response(JSON.stringify({ translatedText: ["영상 자막 안녕"] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ translatedText: ["Korean video caption"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    );

    expect(requests).toEqual([
      {
        body: {
          q: ["Hello from video captions"],
          source: "en",
          target: "ko",
          format: "text",
        },
      },
      {
        body: {
          q: ["한국어 영상 자막입니다"],
          source: "ko",
          target: "en",
          format: "text",
        },
      },
    ]);
    expect(result.displayCues).toMatchObject([
      { id: "english-cue", translatedText: "영상 자막 안녕" },
      { id: "korean-cue", translatedText: "Korean video caption" },
    ]);
  });
});
