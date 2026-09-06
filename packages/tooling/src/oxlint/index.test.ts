import { describe, expect, it } from "bun:test";
import { defineOxlintConfig, sharedOxlintConfig } from "./index.js";

describe("옥린트 구성", () => {
  it("[성공] 기본 설정을 반환하고 내부 참조를 복제함", () => {
    const config = defineOxlintConfig();

    expect(config).toEqual({
      categories: { correctness: "error" },
      plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
      options: { typeAware: true },
      rules: {
        "eslint/prefer-const": "error",
        "typescript/no-explicit-any": "error",
        "typescript/no-misused-promises": "error",
        "jsx-a11y/label-has-associated-control": [
          "error",
          {
            controlComponents: [
              "Checkbox",
              "Input",
              "RadioGroupItem",
              "Select",
              "Textarea",
            ],
          },
        ],
        "jsx-a11y/no-noninteractive-tabindex": [
          "error",
          { roles: ["tabpanel", "region"] },
        ],
        "jsx-a11y/prefer-tag-over-role": "off",
      },
      overrides: [],
    });
    expect(config.categories).not.toBe(sharedOxlintConfig.categories);
    expect(config.plugins).not.toBe(sharedOxlintConfig.plugins);
    expect(config.options).not.toBe(sharedOxlintConfig.options);
    expect(config.rules).not.toBe(sharedOxlintConfig.rules);
  });

  it("[성공] 사용자 카테고리·플러그인·옵션·규칙·override를 병합함", () => {
    const override = {
      files: ["**/*.test.ts"],
      rules: { "typescript/no-explicit-any": "off" as const },
    };
    const config = defineOxlintConfig({
      categories: { correctness: "warn", suspicious: "error" },
      plugins: ["jest"],
      options: { typeAware: false },
      rules: { "eslint/prefer-const": "off" },
      overrides: [override],
    });

    expect(config.categories).toEqual({
      correctness: "warn",
      suspicious: "error",
    });
    expect(config.plugins).toEqual([
      "typescript",
      "unicorn",
      "oxc",
      "react",
      "jsx-a11y",
      "jest",
    ]);
    expect(config.options).toEqual({ typeAware: false });
    expect(config.rules?.["eslint/prefer-const"]).toBe("off");
    expect(config.rules?.["typescript/no-explicit-any"]).toBe("error");
    expect(config.overrides).toEqual([override]);
  });

  it("[성공] 소비자 구성 간 override 배열 독립성 유지", () => {
    const first = defineOxlintConfig({
      overrides: [{ files: ["**/*.test.ts"] }],
    });
    const second = defineOxlintConfig();

    expect(first.overrides).not.toBe(second.overrides);
    expect(second.overrides).toEqual([]);
  });
});
