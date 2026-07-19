import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appAssetContentType, isPathInside, resolveAppAsset } from "./protocol-path";

const rendererRoot = resolve("/private/tmp/git-client-renderer");

describe("app protocol path resolution", () => {
  it("maps the root, assets, and client-side routes inside the renderer root", () => {
    expect(resolveAppAsset(rendererRoot, "app://git-client/")).toEqual({
      kind: "asset",
      path: resolve(rendererRoot, "index.html"),
    });
    expect(resolveAppAsset(rendererRoot, "app://git-client/assets/app.js")).toEqual({
      kind: "asset",
      path: resolve(rendererRoot, "assets/app.js"),
    });
    expect(resolveAppAsset(rendererRoot, "app://git-client/repository/log")).toEqual({
      kind: "asset",
      path: resolve(rendererRoot, "index.html"),
    });
  });

  it("rejects traversal, malformed escapes, and foreign origins", () => {
    expect(resolveAppAsset(rendererRoot, "app://git-client/%2e%2e/secrets.txt")).toEqual({
      kind: "forbidden",
    });
    expect(resolveAppAsset(rendererRoot, "app://git-client/%zz")).toEqual({ kind: "notFound" });
    expect(resolveAppAsset(rendererRoot, "https://git-client/assets/app.js")).toEqual({
      kind: "notFound",
    });
  });

  it("accepts the root itself but no parent or sibling path", () => {
    expect(isPathInside(rendererRoot, rendererRoot)).toBe(true);
    expect(isPathInside(rendererRoot, resolve(rendererRoot, "assets/app.js"))).toBe(true);
    expect(isPathInside(rendererRoot, resolve(rendererRoot, "..", "renderer-copy"))).toBe(false);
  });

  it("serves renderer assets with explicit content types", () => {
    expect(appAssetContentType("index.html")).toBe("text/html; charset=utf-8");
    expect(appAssetContentType("assets/app.js")).toBe("text/javascript; charset=utf-8");
    expect(appAssetContentType("assets/app.css")).toBe("text/css; charset=utf-8");
    expect(appAssetContentType("assets/font.woff2")).toBe("font/woff2");
    expect(appAssetContentType("unknown.bin")).toBe("application/octet-stream");
  });
});
