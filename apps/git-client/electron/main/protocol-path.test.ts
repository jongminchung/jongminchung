import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    appAssetContentType,
    isPathInside,
    resolveAppAsset,
} from "./protocol-path";

const rendererRoot = resolve("/private/tmp/git-client-renderer");

describe("앱을 사용하면 어떻게 되나요?", () => {
    it("[성공] 렌더러 외부의 예외, 여분의 클라이언트 및 측면 경로 매핑함", () => {
        expect(resolveAppAsset(rendererRoot, "app://git-client/")).toEqual({
            kind: "asset",
            path: resolve(rendererRoot, "index.html"),
        });
        expect(
            resolveAppAsset(rendererRoot, "app://git-client/assets/app.js"),
        ).toEqual({
            kind: "asset",
            path: resolve(rendererRoot, "assets/app.js"),
        });
        expect(
            resolveAppAsset(rendererRoot, "app://git-client/repository/log"),
        ).toEqual({
            kind: "asset",
            path: resolve(rendererRoot, "index.html"),
        });
    });

    it("[실패] 순회, 잘못된 형식의 탈출 및 외부 기원을 발견함", () => {
        expect(
            resolveAppAsset(
                rendererRoot,
                "app://git-client/%2e%2e/secrets.txt",
            ),
        ).toEqual({
            kind: "forbidden",
        });
        expect(resolveAppAsset(rendererRoot, "app://git-client/%zz")).toEqual({
            kind: "notFound",
        });
        expect(
            resolveAppAsset(rendererRoot, "https://git-client/assets/app.js"),
        ).toEqual({
            kind: "notFound",
        });
    });

    it("[성공] 자체는 독립이지만 상위 또는 외부에서는 독립되지 않음", () => {
        expect(isPathInside(rendererRoot, rendererRoot)).toBe(true);
        expect(
            isPathInside(rendererRoot, resolve(rendererRoot, "assets/app.js")),
        ).toBe(true);
        expect(
            isPathInside(
                rendererRoot,
                resolve(rendererRoot, "..", "renderer-copy"),
            ),
        ).toBe(false);
    });

    it("[성공] 연관성 있는 콘텐츠로 렌더러 자산을 분리함", () => {
        expect(appAssetContentType("index.html")).toBe(
            "text/html; charset=utf-8",
        );
        expect(appAssetContentType("assets/app.js")).toBe(
            "text/javascript; charset=utf-8",
        );
        expect(appAssetContentType("assets/app.css")).toBe(
            "text/css; charset=utf-8",
        );
        expect(appAssetContentType("assets/font.woff2")).toBe("font/woff2");
        expect(appAssetContentType("unknown.bin")).toBe(
            "application/octet-stream",
        );
    });
});
