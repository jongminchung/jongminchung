import { describe, expect, it, vi } from "vitest";
import { DESKTOP_STREAM_CHANNEL } from "../../src/shared/contracts/desktop-stream";

vi.mock("electron", () => ({ BrowserWindow: {} }));

import { DesktopStreamHub } from "./desktop-stream-hub";

class TestPort {
  readonly posted: unknown[] = [];
  readonly start = vi.fn();
  readonly close = vi.fn(() => this.closeListener?.());
  closeListener: (() => void) | null = null;

  once(event: string, listener: () => void): void {
    if (event === "close") this.closeListener = listener;
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }
}

describe("DesktopStreamHub", () => {
  it("validates the sender, replaces duplicate ports, and publishes typed envelopes", () => {
    const listeners = new Map<string, (event: unknown, raw: unknown) => void>();
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      mainFrame,
      ipc: {
        on: (channel: string, listener: (event: unknown, raw: unknown) => void): void => {
          listeners.set(channel, listener);
        },
        removeListener: (channel: string): void => {
          listeners.delete(channel);
        },
      },
    };
    const window = { webContents };
    const hub = new DesktopStreamHub(window as never);
    const disconnected = vi.fn();
    hub.onDisconnect(disconnected);
    const connect = listeners.get(DESKTOP_STREAM_CHANNEL);
    if (connect === undefined) throw new Error("Missing stream connection listener");
    const first = new TestPort();
    connect({ sender: webContents, senderFrame: mainFrame, ports: [first] }, { version: 1 });

    expect(first.start).toHaveBeenCalledOnce();
    expect(first.posted).toEqual([{ kind: "ready", version: 1 }]);
    hub.publish({ kind: "menu.command", command: { id: "workspace.close" } });
    expect(first.posted.at(-1)).toEqual({
      kind: "menu.command",
      command: { id: "workspace.close" },
    });

    const second = new TestPort();
    connect({ sender: webContents, senderFrame: mainFrame, ports: [second] }, { version: 1 });
    expect(first.close).toHaveBeenCalledOnce();
    expect(disconnected).toHaveBeenCalledOnce();
    expect(second.posted).toEqual([{ kind: "ready", version: 1 }]);

    hub.dispose();
    expect(second.close).toHaveBeenCalledOnce();
    expect(disconnected).toHaveBeenCalledTimes(2);
    expect(listeners.has(DESKTOP_STREAM_CHANNEL)).toBe(false);
  });

  it("rejects version skew and untrusted frames", () => {
    let connect: ((event: unknown, raw: unknown) => void) | undefined;
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      mainFrame,
      ipc: {
        on: (_channel: string, listener: (event: unknown, raw: unknown) => void): void => {
          connect = listener;
        },
        removeListener: vi.fn(),
      },
    };
    new DesktopStreamHub({ webContents } as never);
    if (connect === undefined) throw new Error("Missing stream connection listener");

    expect(() =>
      connect?.(
        { sender: webContents, senderFrame: mainFrame, ports: [new TestPort()] },
        {
          version: 2,
        },
      ),
    ).toThrow();
    expect(() =>
      connect?.(
        {
          sender: webContents,
          senderFrame: { url: "https://attacker.invalid/" },
          ports: [new TestPort()],
        },
        { version: 1 },
      ),
    ).toThrow("main frame");
  });
});
