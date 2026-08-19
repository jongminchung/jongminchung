import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: {} }));

import { assertTrustedSender } from "./ipc-security";

function senderFixture(url: string) {
    const mainFrame = { url };
    const webContents = { mainFrame };
    return {
        event: { sender: webContents, senderFrame: mainFrame },
        window: { webContents },
    } as const;
}

describe("IPC sender 보안", () => {
    it("[성공] app protocol의 main frame을 허용함", () => {
        const { event, window } = senderFixture("app://git-client/");

        expect(() =>
            assertTrustedSender(event as never, window as never),
        ).not.toThrow();
    });

    it("[실패] 설정되지 않은 개발 origin을 거부함", () => {
        const developmentServerUrl = "http://localhost:5173/";
        const trusted = senderFixture("http://localhost:5173/workspace");
        const wrongPort = senderFixture("http://localhost:4173/workspace");

        expect(() =>
            assertTrustedSender(
                trusted.event as never,
                trusted.window as never,
                developmentServerUrl,
            ),
        ).not.toThrow();
        expect(() =>
            assertTrustedSender(
                wrongPort.event as never,
                wrongPort.window as never,
                developmentServerUrl,
            ),
        ).toThrow("origin is not trusted");
    });

    it("[실패] 다른 window와 subframe sender를 거부함", () => {
        const { event, window } = senderFixture("app://git-client/workspace");

        expect(() =>
            assertTrustedSender(
                { ...event, sender: { mainFrame: event.senderFrame } } as never,
                window as never,
            ),
        ).toThrow("main window");
        expect(() =>
            assertTrustedSender(
                {
                    ...event,
                    senderFrame: { url: "app://git-client/workspace" },
                } as never,
                window as never,
            ),
        ).toThrow("main frame");
    });
});
