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
      ko: "계산기부터 에뮬레이터와 언어 모델까지 핵심 원리를 직접 구현하며 이해하는 글 모음",
      en: "Articles that build core ideas directly, from calculators and emulators to language models.",
    },
  },
  "react-ui-architecture": {
    order: 1,
    title: {
      ko: "React UI 설계",
      en: "Designing React UI",
    },
    description: {
      ko: "컴포넌트 경계, 뷰 모델, Headless 패턴으로 React UI의 책임을 설계하는 글 모음",
      en: "Articles on React UI responsibility through component boundaries, view models, and headless patterns.",
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
