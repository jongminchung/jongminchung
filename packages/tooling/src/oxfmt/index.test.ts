import { describe, expect, it } from "vitest";
import { defineOxfmtConfig } from "./index.js";

describe("oxfmt 구성", () => {
    it("[성공] 소비자용 문서화된 공유 기본값 포함", () => {
        expect(defineOxfmtConfig()).toEqual({
            ignorePatterns: [
                ".git/",
                ".husky/_/",
                "coverage/",
                "dist/",
                "build/",
                "node_modules/",
            ],
            overrides: [],
            sortImports: { newlinesBetween: false },
            sortPackageJson: false,
        });
    });

    it("[성공] 뒤에는 반대하는 태도를 추가함", () => {
        const config = defineOxfmtConfig({
            ignorePatterns: ["fixtures/generated/"],
        });

        expect(config.ignorePatterns).toContain("node_modules/");
        expect(config.ignorePatterns.at(-1)).toBe("fixtures/generated/");
    });

    it("[성공] 호출자 배열 공유 없이 로컬 override 추가", () => {
        const overrides = [
            { files: ["generated/**"], options: { tabWidth: 4 } },
        ];
        const config = defineOxfmtConfig({ overrides });

        expect(config.overrides).toEqual(overrides);
        expect(config.overrides).not.toBe(overrides);
    });

    it("[성공] Oxfmt zero-config는 일체형이 아닙니다", () => {
        const config = defineOxfmtConfig();

        expect(config).not.toHaveProperty("printWidth");
        expect(config).not.toHaveProperty("singleQuote");
        expect(config).not.toHaveProperty("semi");
        expect(config).not.toHaveProperty("tabWidth");
        expect(config).not.toHaveProperty("trailingComma");
        expect(config.sortImports).toEqual({ newlinesBetween: false });
        expect(config.sortPackageJson).toBe(false);
    });

    it("[성공] 현재 Oxfmt 옵션을 존중하고 존중하는 구성을 선언함", () => {
        const config = defineOxfmtConfig({
            insertFinalNewline: false,
            objectWrap: "collapse",
            sortImports: { order: "desc" },
            sortPackageJson: { sortScripts: false },
            sortTailwindcss: true,
        });

        expect(config.insertFinalNewline).toBe(false);
        expect(config.objectWrap).toBe("collapse");
        expect(config.sortImports).toEqual({
            newlinesBetween: false,
            order: "desc",
        });
        expect(config.sortPackageJson).toEqual({ sortScripts: false });
        expect(config.sortTailwindcss).toBe(true);
    });

    it("[실패] 존재하는 것을 받아들이지 않고 반환되는 구성을 찾을 수 있음", () => {
        const config = defineOxfmtConfig({
            sortImports: false,
            sortPackageJson: false,
        });

        expect(config.sortImports).toBe(false);
        expect(config.sortPackageJson).toBe(false);
    });

    it("[성공] package.json 정렬 활성화 여부를 그대로 보존함", () => {
        expect(
            defineOxfmtConfig({ sortPackageJson: true }).sortPackageJson,
        ).toBe(true);
        expect(
            defineOxfmtConfig({
                sortPackageJson: { sortScripts: false },
            }).sortPackageJson,
        ).toEqual({ sortScripts: false });
    });

    it("[성공] 구성하면 상관없을 것 같습니다", () => {
        const first = defineOxfmtConfig();
        const second = defineOxfmtConfig();

        expect(first.sortImports).not.toBe(second.sortImports);

        if (typeof first.sortImports !== "object")
            throw new Error("expected default sort options to be an object");
        Object.assign(first.sortImports, { newlinesBetween: true });

        expect(second.sortImports).toEqual({ newlinesBetween: false });
    });

    it("[성공] package.json 객체형 override를 공유하지 않음", () => {
        const options = { sortScripts: false };
        const config = defineOxfmtConfig({ sortPackageJson: options });

        expect(config.sortPackageJson).toEqual(options);
        expect(config.sortPackageJson).not.toBe(options);
    });

    it("[성공] 공식 Oxfmt에 대한 응답을 사용함", () => {
        const compileTimeOnly = () => {
            // @ts-expect-error Oxfmt only accepts its documented arrowParens values.
            defineOxfmtConfig({ arrowParens: "sometimes" });
            // @ts-expect-error Oxfmt overrides require at least one files pattern.
            defineOxfmtConfig({ overrides: [{ options: { tabWidth: 4 } }] });
        };

        expect(compileTimeOnly).toBeTypeOf("function");
    });
});
