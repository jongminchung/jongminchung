import { defineConfig, type OxlintConfig } from "oxlint";

export type { OxlintConfig } from "oxlint";

export const sharedOxlintConfig = defineConfig({
    // Oxlint의 공식 권장 기본값을 오류로 적용함
    // 나쁜 예: if (value = nextValue)처럼 조건식에서 값을 대입함
    // 좋은 예: if (value === nextValue)처럼 비교 의도를 명시함
    categories: {
        correctness: "error",
    },
    plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y"],
    options: {
        typeAware: true,
    },
    rules: {
        // 재할당하지 않는 binding은 변경 가능성을 노출하지 않도록 const로 고정함
        // 나쁜 예: let count = items.length
        // 좋은 예: const count = items.length
        "eslint/prefer-const": "error",

        // any는 이후 접근의 타입 검사를 모두 우회하므로 경계 타입이나 type guard를 사용함
        // 나쁜 예: (window as any).desktopApi
        // 좋은 예: Window 인터페이스를 확장하고 window.desktopApi를 사용함
        "typescript/no-explicit-any": "error",

        // void callback에 Promise를 직접 전달하면 rejection 처리 계약이 사라질 수 있음
        // 나쁜 예: <button onClick={save}>저장</button>
        // 좋은 예: <button onClick={() => void save()}>저장</button>
        "typescript/no-misused-promises": "error",

        // 공용 form component도 native control처럼 label 연결 여부를 검사함
        // 나쁜 예: <label>이름<Input /></label>에서 Input을 control로 인식하지 못함
        // 좋은 예: <label htmlFor="name">이름</label><Input id="name" />를 검사함
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

        // 이름이 있는 스크롤 region은 키보드 사용자가 내용을 탐색하도록 focus를 허용함
        // 나쁜 예: <div tabIndex={0}>처럼 의미와 이름 없이 focus를 추가함
        // 좋은 예: <section role="region" aria-label="코드" tabIndex={0}>를 사용함
        "jsx-a11y/no-noninteractive-tabindex": [
            "error",
            { roles: ["tabpanel", "region"] },
        ],

        // role=group에 fieldset을 강제하는 제안은 form이 아닌 UI group의 의미를 바꿀 수 있음
        // 허용 예: <div role="group" aria-label="편집기 도구">...</div>
        // 금지 예: <div role="button">...</div>는 다른 권장 접근성 규칙이 계속 차단함
        "jsx-a11y/prefer-tag-over-role": "off",
    },
});

export function defineOxlintConfig(config: OxlintConfig = {}): OxlintConfig {
    return defineConfig({
        ...sharedOxlintConfig,
        ...config,
        categories: {
            ...sharedOxlintConfig.categories,
            ...config.categories,
        },
        plugins: [...sharedOxlintConfig.plugins, ...(config.plugins ?? [])],
        options: {
            ...sharedOxlintConfig.options,
            ...config.options,
        },
        rules: {
            ...sharedOxlintConfig.rules,
            ...config.rules,
        },
        overrides: [...(config.overrides ?? [])],
    });
}
