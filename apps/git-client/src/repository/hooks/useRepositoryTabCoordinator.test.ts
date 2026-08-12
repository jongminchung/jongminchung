import { describe, expect, it } from "vitest";
import { closeLogTabState } from "./useRepositoryTabCoordinator";

describe("repository tab coordinator transitions", () => {
    it("returns to the first inspector after closing the only active log tab", () => {
        expect(
            closeLogTabState({
                activeInspectorKey: undefined,
                activeLogTabId: "log-1",
                fallbackInspectorKey: "file:README.md",
                logTabIds: ["log-1"],
                tabId: "log-1",
            }),
        ).toEqual({
            activeLogTabId: "log-1",
            activateInspectorKey: "file:README.md",
            focusValue: "inspector:file:README.md",
            logOpen: false,
            logTabIds: ["log-1"],
        });
    });

    it("keeps the fallback log contract when no inspector exists", () => {
        expect(
            closeLogTabState({
                activeInspectorKey: undefined,
                activeLogTabId: "log-1",
                fallbackInspectorKey: undefined,
                logTabIds: ["log-1"],
                tabId: "log-1",
            }),
        ).toMatchObject({
            activateInspectorKey: null,
            focusValue: undefined,
            logOpen: false,
        });
    });

    it("selects the adjacent tab when the active log tab closes", () => {
        expect(
            closeLogTabState({
                activeInspectorKey: undefined,
                activeLogTabId: "log-2",
                fallbackInspectorKey: undefined,
                logTabIds: ["log-1", "log-2", "log-3"],
                tabId: "log-2",
            }),
        ).toEqual({
            activeLogTabId: "log-3",
            activateInspectorKey: null,
            focusValue: "log:log-3",
            logOpen: true,
            logTabIds: ["log-1", "log-3"],
        });
    });
});
