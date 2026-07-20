import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NotificationToolWindow } from "./NotificationToolWindow";

describe("NotificationToolWindow", () => {
  it("renders operation history and clear/close actions", () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationToolWindow, {
        notifications: [
          {
            id: "fetch-1",
            title: "Fetching",
            message: "Completed",
            kind: "success",
            createdAt: 10,
          },
        ],
        onClear: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    expect(markup).toContain('aria-label="Notifications"');
    expect(markup).toContain("Fetching");
    expect(markup).toContain('aria-label="Clear Notifications"');
    expect(markup).toContain('aria-label="Close Notifications"');
  });
});
