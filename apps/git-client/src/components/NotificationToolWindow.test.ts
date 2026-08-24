import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NotificationToolWindow } from "./NotificationToolWindow";

describe("알림도구창", () => {
  it("[성공] 작업 내 역 및 지우기/닫기 작업을 마감함", () => {
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
