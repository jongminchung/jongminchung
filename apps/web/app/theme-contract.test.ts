import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const read = (path: string): string =>
    readFileSync(resolve(root, path), "utf8");
const readComponentStyles = (path: string): readonly string[] =>
    readdirSync(resolve(root, path), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".module.css"))
        .map((entry) => read(`${path}/${entry.name}`));

const sharedTheme = read("packages/ui/src/styles/theme.css");
const tailwindTokens = read("packages/ui/src/styles/tokens.css");
const siteStyles = [
    "apps/web/app/(home)/home.css",
    "apps/web/app/(tech)/tech.css",
    "apps/web/app/(invest)/invest.css",
].map(read);
const domainComponentStyles = [
    ...readComponentStyles("apps/web/app/(home)/_components"),
    ...readComponentStyles("apps/web/app/(tech)/_components"),
    ...readComponentStyles("apps/web/app/(invest)/_components"),
];

const requiredRoles = [
    "--background",
    "--foreground",
    "--card",
    "--popover",
    "--primary",
    "--secondary",
    "--muted",
    "--accent",
    "--destructive",
    "--border",
    "--input",
    "--ring",
];

const baseOnlyRoles = [
    "--font-family-body",
    "--font-family-heading",
    "--font-family-code",
    "--radius",
    "--elevation-low",
    "--elevation-medium",
    "--elevation-high",
];

const removedDomainTokens = [
    "brand-gradient-mid",
    "brand-highlight",
    "primary-emphasis",
    "inverse-",
    "syntax-background",
    "excalidraw-canvas",
    "warning",
    "duration-fast",
];

describe("공통 디자인 토큰 계약", () => {
    it("[성공] 라이트와 다크 테마가 공용 역할을 모두 정의함", () => {
        const darkTheme = sharedTheme.split(
            ':where(:root[data-theme="dark"])',
        )[1];

        expect(darkTheme).toBeDefined();
        for (const role of requiredRoles) {
            expect(sharedTheme).toContain(`${role}:`);
            expect(darkTheme).toContain(`${role}:`);
            expect(tailwindTokens).toContain(`var(${role})`);
        }
        for (const role of baseOnlyRoles) {
            expect(sharedTheme).toContain(`${role}:`);
        }
    });

    it("[성공] 사이트 CSS가 색상 토큰을 재정의하지 않음", () => {
        for (const stylesheet of siteStyles) {
            expect(stylesheet).not.toMatch(/^\s*--[\w-]+\s*:/mu);
        }
    });

    it("[성공] 제거한 도메인 토큰을 다시 사용하지 않음", () => {
        const styles = [
            sharedTheme,
            ...siteStyles,
            ...domainComponentStyles,
        ].join("\n");

        for (const token of removedDomainTokens) {
            expect(styles).not.toContain(`--${token}`);
        }
    });

    it("[성공] Pretendard를 next/font의 자체 호스팅 폰트로 등록함", () => {
        const fontDefinition = read("apps/web/app/fonts.ts");

        expect(fontDefinition).toContain('from "next/font/local"');
        expect(fontDefinition).toContain("PretendardVariable.woff2");
        expect(fontDefinition).toContain('variable: "--font-pretendard"');
        expect(read("packages/ui/src/styles/theme.css")).toContain(
            "var(--font-pretendard)",
        );
    });
});
