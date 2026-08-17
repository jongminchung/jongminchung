import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    dispatchWorkbenchEvent,
    listenWorkbenchEvent,
} from "../../application/workbench-events/WorkbenchEventPort";
import { installBrowserWorkbenchEventPort } from "./workbenchEvents";

describe("워크벤치 이벤트 어댑터", () => {
    vi.stubGlobal("window", new EventTarget());
    let uninstall: () => void;

    beforeEach(() => {
        uninstall = installBrowserWorkbenchEventPort();
    });

    afterEach(() => {
        uninstall();
        vi.restoreAllMocks();
    });

    it("[성공] 입력 세부정보를 전달하고 구독을 제거함", () => {
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

    it("[성공] 취소를 취소 결과로 유지함", () => {
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
