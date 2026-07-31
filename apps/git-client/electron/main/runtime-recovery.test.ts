import { describe, expect, it, vi } from "vitest";
import { monitorWindowRuntime } from "./runtime-recovery";

function fixture(response: number) {
  const windowListeners = new Map<string, (...args: never[]) => void>();
  const webContentsListeners = new Map<string, (...args: never[]) => void>();
  const reload = vi.fn();
  const close = vi.fn();
  const window = {
    isDestroyed: () => false,
    close,
    on: (event: string, listener: (...args: never[]) => void) => {
      windowListeners.set(event, listener);
    },
    webContents: {
      reload,
      on: (event: string, listener: (...args: never[]) => void) => {
        webContentsListeners.set(event, listener);
      },
    },
  };
  const recordRuntimeFailure = vi.fn(async () => undefined);
  const showMessageBox = vi.fn(async () => ({ response }));
  const relaunch = vi.fn();
  const quit = vi.fn();
  monitorWindowRuntime(window as never, {
    diagnostics: { recordRuntimeFailure },
    showMessageBox,
    relaunch,
    quit,
  });
  return {
    close,
    quit,
    recordRuntimeFailure,
    reload,
    relaunch,
    showMessageBox,
    webContentsListeners,
    windowListeners,
  };
}

describe("runtime recovery", () => {
  it("records renderer crashes and reloads only after explicit selection", async () => {
    const recovery = fixture(0);
    recovery.webContentsListeners.get("render-process-gone")?.(
      {} as never,
      { reason: "crashed", exitCode: 9 } as never,
    );
    await vi.waitFor(() => expect(recovery.showMessageBox).toHaveBeenCalledOnce());
    expect(recovery.recordRuntimeFailure).toHaveBeenCalledWith({
      kind: "rendererGone",
      message: "Renderer process exited unexpectedly.",
      details: { reason: "crashed", exitCode: 9 },
    });
    expect(recovery.reload).toHaveBeenCalledOnce();
    expect(recovery.relaunch).not.toHaveBeenCalled();
  });

  it("waits without mutating application state when an unresponsive window is dismissed", async () => {
    const recovery = fixture(0);
    recovery.windowListeners.get("unresponsive")?.();
    await vi.waitFor(() => expect(recovery.showMessageBox).toHaveBeenCalledOnce());
    expect(recovery.reload).not.toHaveBeenCalled();
    expect(recovery.relaunch).not.toHaveBeenCalled();
    expect(recovery.quit).not.toHaveBeenCalled();
    expect(recovery.close).not.toHaveBeenCalled();
  });
});
