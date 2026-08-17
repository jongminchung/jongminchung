import { describe, expect, it, vi } from "vitest";
import {
    installDefaultDenyPermissionPolicy,
    isTrustedRendererNavigation,
} from "./window-security";

describe("창 권한 부여", () => {
    it("[실패] 기본적으로 권한 확인 및 요청을 하였음", () => {
        const setPermissionCheckHandler = vi.fn();
        const setPermissionRequestHandler = vi.fn();

        installDefaultDenyPermissionPolicy({
            setPermissionCheckHandler,
            setPermissionRequestHandler,
        } as never);

        const check = setPermissionCheckHandler.mock
            .calls[0]?.[0] as () => boolean;
        expect(check()).toBe(false);

        const request = setPermissionRequestHandler.mock.calls[0]?.[0] as (
            webContents: unknown,
            permission: string,
            callback: (allowed: boolean) => void,
        ) => void;
        const callback = vi.fn();
        request({}, "media", callback);
        expect(callback).toHaveBeenCalledWith(false);
    });

    it("[실패] URL 자격 증명 없이 앱 및 개발을 할 수 있다는 신뢰를 갖고 있음", () => {
        const developmentUrl = "http://localhost:5173/";
        expect(
            isTrustedRendererNavigation(
                "app://git-client/workspace",
                developmentUrl,
            ),
        ).toBe(true);
        expect(
            isTrustedRendererNavigation(
                "http://localhost:5173/local-history",
                developmentUrl,
            ),
        ).toBe(true);
        expect(
            isTrustedRendererNavigation(
                "app://git-client.evil/workspace",
                developmentUrl,
            ),
        ).toBe(false);
        expect(
            isTrustedRendererNavigation(
                "http://localhost:5173.evil/local-history",
                developmentUrl,
            ),
        ).toBe(false);
        expect(
            isTrustedRendererNavigation(
                "http://git-client@localhost:5173/local-history",
                developmentUrl,
            ),
        ).toBe(false);
        expect(
            isTrustedRendererNavigation(
                "http://localhost:4173/",
                developmentUrl,
            ),
        ).toBe(false);
    });
});
