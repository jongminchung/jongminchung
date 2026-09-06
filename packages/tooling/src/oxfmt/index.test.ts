import { describe, expect, it } from "bun:test";
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

  it("[성공] 기본 제외 경로 뒤에 사용자 제외 경로를 추가함", () => {
    const config = defineOxfmtConfig({
      ignorePatterns: ["fixtures/generated/"],
    });

    expect(config.ignorePatterns).toContain("node_modules/");
    expect(config.ignorePatterns.at(-1)).toBe("fixtures/generated/");
  });

  it("[성공] 호출자 배열 공유 없이 로컬 override 추가", () => {
    const overrides = [{ files: ["generated/**"], options: { tabWidth: 4 } }];
    const config = defineOxfmtConfig({ overrides });

    expect(config.overrides).toEqual(overrides);
    expect(config.overrides).not.toBe(overrides);
  });

  it("[성공] 명시하지 않은 포맷 옵션은 Oxfmt 기본값에 위임함", () => {
    const config = defineOxfmtConfig();

    expect(config).not.toHaveProperty("printWidth");
    expect(config).not.toHaveProperty("singleQuote");
    expect(config).not.toHaveProperty("semi");
    expect(config).not.toHaveProperty("tabWidth");
    expect(config).not.toHaveProperty("trailingComma");
    expect(config.sortImports).toEqual({ newlinesBetween: false });
    expect(config.sortPackageJson).toBe(false);
  });

  it("[성공] 사용자가 지정한 포맷과 정렬 옵션을 보존함", () => {
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

  it("[성공] 정렬 비활성화 옵션을 그대로 보존함", () => {
    const config = defineOxfmtConfig({
      sortImports: false,
      sortPackageJson: false,
    });

    expect(config.sortImports).toBe(false);
    expect(config.sortPackageJson).toBe(false);
  });

  it("[성공] package.json 정렬 활성화 여부를 그대로 보존함", () => {
    expect(defineOxfmtConfig({ sortPackageJson: true }).sortPackageJson).toBe(
      true,
    );
    expect(
      defineOxfmtConfig({
        sortPackageJson: { sortScripts: false },
      }).sortPackageJson,
    ).toEqual({ sortScripts: false });
  });

  it("[성공] 한 구성의 정렬 옵션 변경이 다른 구성에 영향을 주지 않음", () => {
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

  it("[성공] 공식 Oxfmt 타입이 잘못된 옵션을 거부함", () => {
    const compileTimeOnly = () => {
      // @ts-expect-error Oxfmt only accepts its documented arrowParens values.
      defineOxfmtConfig({ arrowParens: "sometimes" });
      // @ts-expect-error Oxfmt overrides require at least one files pattern.
      defineOxfmtConfig({ overrides: [{ options: { tabWidth: 4 } }] });
    };

    expect(compileTimeOnly).toBeTypeOf("function");
  });
});
