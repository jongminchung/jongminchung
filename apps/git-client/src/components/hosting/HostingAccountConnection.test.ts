import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HostingAccountConnection } from "./HostingAccountConnection";

describe("HostingAccountConnection", () => {
    it("[성공] PAT 권한과 Git credential 경계를 연결 전에 안내함", () => {
        const markup = renderToStaticMarkup(
            createElement(HostingAccountConnection, {
                accountId: "",
                accounts: [],
                initialBaseUrl: "https://github.com",
                initialProvider: "gitHub",
                onConnect: vi.fn(),
                onRemove: vi.fn(),
            }),
        );
        expect(markup).toContain("fine-grained token");
        expect(markup).toContain("Git push credentials are managed separately");
        expect(markup).toContain("Browser sign-in is unavailable");
        expect(markup).toContain("cloud and self-hosted servers");
    });
});
