import { describe, expect, test } from "vitest";
import {
  ACTIVE_TAB_CAPTION_IDLE_STATE,
  ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE,
  ACTIVE_TAB_WEBPAGE_IDLE_STATE,
  getActiveTabPageSupport,
  isTrustedContentSender,
  isTrustedControlSender,
  parseCaptionCollectionResponse,
  parseWebpageCollectionResponse,
} from "./active-tab-translation";

const INTERNAL_USER_VISIBLE_TERMS =
  /provider|MLX|LibreTranslate|browser-detectable|caption cues|script|endpoint|스크립트|브라우저/i;

describe("active tab translation sender trust", () => {
  test("trusts extension content messages only when they include a sender tab", () => {
    expect(isTrustedContentSender({ id: "extension-id", tab: { id: 12 } }, "extension-id")).toBe(
      true,
    );
    expect(isTrustedContentSender({ id: "extension-id" }, "extension-id")).toBe(false);
    expect(isTrustedContentSender({ id: "other-extension", tab: { id: 12 } }, "extension-id")).toBe(
      false,
    );
  });

  test("keeps popup control messages separate from content sender messages", () => {
    expect(
      isTrustedControlSender(
        { id: "extension-id", url: "chrome-extension://extension-id/popup.html" },
        "extension-id",
      ),
    ).toBe(true);
    expect(isTrustedControlSender({ id: "extension-id", tab: { id: 12 } }, "extension-id")).toBe(
      false,
    );
  });

  test("keeps shared user-visible status copy free of implementation terms", () => {
    const messages = [
      ACTIVE_TAB_CAPTION_IDLE_STATE.message,
      ACTIVE_TAB_WEBPAGE_IDLE_STATE.message,
      ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE.message,
      getActiveTabPageSupport("chrome://settings").reason,
      parseCaptionCollectionResponse({ ok: true, state: "no-captions", message: "" })?.message,
      parseWebpageCollectionResponse({ ok: true, state: "no-content", message: "" })?.message,
    ];

    for (const message of messages) {
      const text = message ?? "";
      expect(text).not.toHaveLength(0);
      expect(text).not.toMatch(INTERNAL_USER_VISIBLE_TERMS);
    }
  });
});
