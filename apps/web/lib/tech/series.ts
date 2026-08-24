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
  "domain-driven-design": {
    order: 0,
    title: {
      ko: "도메인 주도 설계",
      en: "Domain-Driven Design",
    },
    description: {
      ko: "문제 공간의 언어를 경계와 모델, 협업 방식으로 연결하는 글 모음",
      en: "Articles connecting problem-space language to boundaries, models, and collaboration.",
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
