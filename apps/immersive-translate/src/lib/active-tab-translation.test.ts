import { describe, expect, test } from "vitest";
import { isTrustedContentSender, isTrustedControlSender } from "./active-tab-translation";

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
});
