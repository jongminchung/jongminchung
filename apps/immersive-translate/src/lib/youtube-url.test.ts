import { describe, expect, test } from "vitest";
import { youtubeVideoIdFromUrl } from "./youtube-url";

describe("youtubeVideoIdFromUrl", () => {
  test("reads video ids from common YouTube URL shapes", () => {
    expect(youtubeVideoIdFromUrl("https://youtu.be/v4Ijkq6Myfc?si=gmESKELLtJ_XxRr3")).toBe(
      "v4Ijkq6Myfc",
    );
    expect(youtubeVideoIdFromUrl("https://www.youtube.com/watch?v=v4Ijkq6Myfc")).toBe(
      "v4Ijkq6Myfc",
    );
    expect(youtubeVideoIdFromUrl("https://m.youtube.com/shorts/v4Ijkq6Myfc")).toBe("v4Ijkq6Myfc");
    expect(youtubeVideoIdFromUrl("https://www.youtube.com/embed/v4Ijkq6Myfc")).toBe("v4Ijkq6Myfc");
    expect(youtubeVideoIdFromUrl("https://www.youtube.com/watch?v=selected-korean-fallback")).toBe(
      "selected-korean-fallback",
    );
  });

  test("ignores unsupported hosts and invalid ids", () => {
    expect(youtubeVideoIdFromUrl("https://example.com/watch?v=v4Ijkq6Myfc")).toBe(null);
    expect(youtubeVideoIdFromUrl("https://youtu.be/not valid")).toBe(null);
    expect(youtubeVideoIdFromUrl(undefined)).toBe(null);
  });
});
