import { describe, expect, it } from "vitest";
import { createTechUiStore } from "#lib/tech-ui-store";

describe("createTechUiStore", () => {
    it("isolates state between provider store instances", () => {
        const first = createTechUiStore();
        const second = createTechUiStore();

        first.getState().setThemeMode("dark");
        first.getState().openSearch();

        expect(first.getState()).toMatchObject({
            themeMode: "dark",
            searchOpen: true,
            searchHasOpened: true,
        });
        expect(second.getState()).toMatchObject({
            themeMode: "system",
            searchOpen: false,
            searchHasOpened: false,
        });
    });

    it("keeps the lazy-open marker after closing search", () => {
        const store = createTechUiStore();

        store.getState().openSearch();
        store.getState().closeSearch();

        expect(store.getState()).toMatchObject({
            searchOpen: false,
            searchHasOpened: true,
        });
    });
});
