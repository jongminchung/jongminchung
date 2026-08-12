import { defineOxfmtConfig } from "./packages/tooling/src/oxfmt/index.ts";

export default defineOxfmtConfig({
    ignorePatterns: [
        // 원본 예: apps/engineering-docs/app/** → 생성물 예: apps/engineering-docs/.next/**
        "**/.next/",
        // 원본 예: apps/readme/app/** → 생성물 예: apps/readme/.output/** 또는 .wxt/**
        "**/.output/",
        "**/.wxt/",
        // 원본 예: content/*.mdx·components/materials/topics/** → 생성물 예: generated/*.json·registry.tsx
        "apps/engineering-docs/generated/",
        // 원본 예: content/*.mdx → 생성물 예: public/search/ko.json
        "apps/engineering-docs/public/search/",
        // 원본 예: tests/*.spec.ts → 실행 산출물 예: playwright-report/**·test-results/**·rebased/**
        "playwright-report/",
        "test-results/",
        "rebased/",
    ],
});
