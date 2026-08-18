import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
    sortPackageJson: false,
    ignorePatterns: [
        // 원본 예: apps/web/app/** → 생성물 예: apps/web/.next/**
        "**/.next/",
        // 원본 예: app/** → 생성물 예: .output/** 또는 .wxt/**
        "**/.output/",
        "**/.wxt/",
        // 원본 예: content/*.mdx·components/materials/topics/** → 생성물 예: generated/*.json·registry.tsx
        "apps/web/generated/",
        // 원본 예: content/*.mdx → 생성물 예: public/search/ko.json
        "apps/web/public/search/",
        // 원본 예: tests/*.spec.ts → 실행 산출물 예: playwright-report/**·test-results/**·rebased/**
        "playwright-report/",
        "test-results/",
        "rebased/",
    ],
});
