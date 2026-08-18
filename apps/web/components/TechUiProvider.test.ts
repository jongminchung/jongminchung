import { describe, expect, it } from "vitest";
import { createTechUiStore } from "#lib/tech-ui-store";

describe("createTechUi스토어", () => {
    it("[성공]공급자 전원 상태를 펀치함", () => {
        const first = createTechUiStore();
        const second = createTechUiStore();

        first.getState().openSearch();

        expect(first.getState()).toMatchObject({
            searchOpen: true,
            searchHasOpened: true,
        });
        expect(second.getState()).toMatchObject({
            searchOpen: false,
            searchHasOpened: false,
        });
    });

    it("[성공] 검색을 늦추는 후 안내 마커를 유지함", () => {
        const store = createTechUiStore();

        store.getState().openSearch();
        store.getState().closeSearch();

        expect(store.getState()).toMatchObject({
            searchOpen: false,
            searchHasOpened: true,
        });
    });
});
