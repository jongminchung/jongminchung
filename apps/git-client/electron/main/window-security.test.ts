import { describe, expect, it, vi } from "vitest";
import {
    installDefaultDenyPermissionPolicy,
    isTrustedRendererNavigation,
} from "./window-security";

describe("window permission policy", () => {
    it("denies permission checks and requests by default", () => {
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

    it("trusts exact app and development origins without URL credentials", () => {
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
