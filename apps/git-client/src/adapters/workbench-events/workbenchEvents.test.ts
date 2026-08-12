import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    dispatchWorkbenchEvent,
    listenWorkbenchEvent,
} from "../../application/workbench-events/WorkbenchEventPort";
import { installBrowserWorkbenchEventPort } from "./workbenchEvents";

describe("workbench event adapter", () => {
    vi.stubGlobal("window", new EventTarget());
    let uninstall: () => void;

    beforeEach(() => {
        uninstall = installBrowserWorkbenchEventPort();
    });

    afterEach(() => {
        uninstall();
        vi.restoreAllMocks();
    });

    it("delivers typed details and removes subscriptions", () => {
        const listener = vi.fn();
        const remove = listenWorkbenchEvent(
            "git-client:terminal-tab-navigate",
            listener,
        );

        dispatchWorkbenchEvent("git-client:terminal-tab-navigate", {
            offset: 1,
        });
        remove();
        dispatchWorkbenchEvent("git-client:terminal-tab-navigate", {
            offset: -1,
        });

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(
            { offset: 1 },
            expect.objectContaining({ preventDefault: expect.any(Function) }),
        );
    });

    it("preserves cancellation as the dispatch result", () => {
        const prevent = (event: Event): void => event.preventDefault();
        window.addEventListener("git-client:editor-action", prevent);

        expect(
            dispatchWorkbenchEvent(
                "git-client:editor-action",
                { action: "undo" },
                { cancelable: true },
            ),
        ).toBe(false);

        window.removeEventListener("git-client:editor-action", prevent);
    });
});
