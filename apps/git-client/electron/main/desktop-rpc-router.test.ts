import { describe, expect, it, vi } from "vitest";
import { DESKTOP_RPC_CHANNELS, RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
import { DesktopRpcRouter } from "./desktop-rpc-router";

type Handler = (event: unknown, raw: unknown) => unknown;

function fixture() {
  const handlers = new Map<string, Handler>();
  const contents = {
    ipc: {
      handle: (channel: string, handler: Handler): void => {
        handlers.set(channel, handler);
      },
      removeHandler: (channel: string): void => {
        handlers.delete(channel);
      },
    },
  };
  return { contents, handlers };
}

describe("DesktopRpcRouter", () => {
  it("dispatches registered procedures through a window-scoped domain channel", async () => {
    const { contents, handlers } = fixture();
    const router = new DesktopRpcRouter(contents as never);
    const procedure = vi.fn(() => ({ kind: "electron" }));
    router.handle(RPC_PROCEDURES.runtimeInfo, procedure);
    const domainHandler = handlers.get(DESKTOP_RPC_CHANNELS.platform);
    if (domainHandler === undefined) throw new Error("Missing platform domain handler");

    expect(
      domainHandler(
        { sender: contents },
        {
          procedure: RPC_PROCEDURES.runtimeInfo,
          payload: undefined,
        },
      ),
    ).toEqual({ kind: "electron" });
    expect(procedure).toHaveBeenCalledOnce();
  });

  it("rejects cross-domain and unregistered procedures and disposes one domain handler", async () => {
    const { contents, handlers } = fixture();
    const router = new DesktopRpcRouter(contents as never);
    router.handle(RPC_PROCEDURES.runtimeInfo, () => undefined);
    const domainHandler = handlers.get(DESKTOP_RPC_CHANNELS.platform);
    if (domainHandler === undefined) throw new Error("Missing platform domain handler");

    expect(() => domainHandler({}, { procedure: RPC_PROCEDURES.gitQuery, payload: {} })).toThrow(
      "wrong channel",
    );
    expect(() =>
      domainHandler({}, { procedure: RPC_PROCEDURES.settingsGet, payload: { key: "theme" } }),
    ).toThrow("unavailable");

    router.dispose();
    expect(handlers.size).toBe(0);
  });
});
