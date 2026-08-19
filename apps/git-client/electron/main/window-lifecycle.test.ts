import { describe, expect, it } from "vitest";
import {
    shouldQuitAfterLastWindow,
    shouldRequestProjectClose,
    shouldCreateWindowOnActivate,
    secondInstanceAction,
    WELCOME_TRAFFIC_LIGHT_POSITION,
} from "./window-lifecycle";

describe("창생기간", () => {
    it("[성공] 작업공간 닫기 요청을 다시 렌더러로 나누기", () => {
        expect(shouldRequestProjectClose("workspace", false)).toBe(true);
        expect(shouldRequestProjectClose("welcome", false)).toBe(false);
    });

    it("[실패] 전통적인 종료를 가로채지 않는 경우", () => {
        expect(shouldRequestProjectClose("workspace", true)).toBe(false);
    });

    it("[성공] 마지막 인스턴스 로그 macOS 구조를 유지함으로써 유지함", () => {
        expect(shouldQuitAfterLastWindow("darwin")).toBe(false);
        expect(shouldQuitAfterLastWindow("linux")).toBe(true);
        expect(shouldQuitAfterLastWindow("win32")).toBe(true);
    });

    it("[성공] 27px 시작 표시줄의 macOS 신호등 중앙에 위치", () => {
        expect(WELCOME_TRAFFIC_LIGHT_POSITION).toEqual({ x: 14, y: 7 });
    });

    it("[성공] activate는 마지막 창이 사라진 경우에만 창을 재생성함", () => {
        expect(shouldCreateWindowOnActivate(0)).toBe(true);
        expect(shouldCreateWindowOnActivate(1)).toBe(false);
        expect(shouldCreateWindowOnActivate(2)).toBe(false);
    });

    it("[성공] 두 번째 instance는 외부 argument를 해석하지 않고 기존 창만 focus함", () => {
        expect(secondInstanceAction()).toBe("focus-existing-window");
    });
});
