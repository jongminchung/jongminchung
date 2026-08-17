import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Notice } from "./Notice";

describe("Git 클라이언트 제품 구성 요소 변형", () => {
    it("[성공] 경고음 및 라이브 역할을 경고로 표시함", () => {
        const alert = renderToStaticMarkup(
            createElement(
                Notice,
                {
                    role: "alert",
                    tone: "destructive",
                },
                "Remote commits may be replaced.",
            ),
        );
        const status = renderToStaticMarkup(
            createElement(
                Notice,
                {
                    role: "status",
                    size: "sm",
                    tone: "success",
                },
                "Repository created.",
            ),
        );

        expect(alert).toContain('role="alert"');
        expect(status).toContain('role="status"');
        expect(alert).toContain("Remote commits may be replaced.");
        expect(status).toContain("Repository created.");
    });
});
