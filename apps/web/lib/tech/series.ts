import { z } from "zod";
import {
  localeSchema,
  nonEmptyTrimmedStringSchema,
  type Locale,
} from "../content-contracts.ts";

const seriesIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "series ID must be a lowercase slug.");

const seriesRegistrySchema = z
  .record(
    seriesIdSchema,
    z
      .strictObject({
        order: z.number().int().nonnegative(),
        title: z.record(localeSchema, nonEmptyTrimmedStringSchema),
        description: z.record(localeSchema, nonEmptyTrimmedStringSchema),
      })
      .readonly(),
  )
  .readonly();

export const seriesRegistry = seriesRegistrySchema.parse({
  "building-from-first-principles": {
    order: 0,
    title: {
      ko: "바닥부터 직접 만들어보기",
      en: "Building from First Principles",
    },
    description: {
      ko: "직접 구현은 완성품을 재현하는 일이 아니라 추상화가 숨긴 경계와 실패 조건을 드러내는 가장 빠른 조사법이라는 주장을 검증하는 시리즈",
      en: "A series testing the claim that implementation is the fastest way to expose boundaries and failure modes hidden by abstractions.",
    },
  },
  "react-ui-architecture": {
    order: 1,
    title: {
      ko: "React UI 설계",
      en: "Designing React UI",
    },
    description: {
      ko: "좋은 React UI는 컴포넌트 수가 아니라 상태·동작·표현의 책임 경계를 명시할 때 만들어진다는 주장을 검증하는 시리즈",
      en: "A series testing the claim that good React UI comes from explicit ownership of state, behavior, and presentation—not component count.",
    },
  },
  "subscription-first-ai-workspace": {
    order: 2,
    title: {
      ko: "구독형 AI 워크스페이스",
      en: "A Subscription-First AI Workspace",
    },
    description: {
      ko: "월 US$20 구독 비교에서 시작해 측정·컨텍스트·세션·도구 출력·모델 라우팅·다중 구독·손익분기점 순으로 사용량 대비 완료 작업을 높이는 8편 시리즈",
      en: "An eight-part series moving from US$20 plan comparison through measurement, context, sessions, tool output, model routing, orchestration, and break-even decisions.",
    },
  },
});

export type SeriesId = keyof typeof seriesRegistry;
export type SeriesDefinition = (typeof seriesRegistry)[SeriesId];

/** `isSeriesId` 등록된 시리즈 식별자를 판별함 */
export function isSeriesId(value: string): value is SeriesId {
  return value in seriesRegistry;
}

/** `getSeries` 시리즈의 지역화된 정보를 조회함 */
export function getSeries(id: string, locale: Locale) {
  const series = isSeriesId(id) ? seriesRegistry[id] : undefined;
  if (series === undefined) return null;
  return Object.freeze({
    id,
    order: series.order,
    title: series.title[locale],
    description: series.description[locale],
  });
}
