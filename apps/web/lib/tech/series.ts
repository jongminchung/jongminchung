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
  "cilium-gateway-api": {
    order: 0,
    title: {
      ko: "Cilium Gateway API 외부 트래픽 설계",
      en: "Designing External Traffic with Cilium Gateway API",
    },
    description: {
      ko: "로드 밸런서, 멀티 컨트롤 플레인, 공급자 SDN의 노드별 공인 IP 환경에서 외부 트래픽 진입점을 설계하는 실전 가이드",
      en: "A practical guide to external traffic entry points with load balancers, highly available control planes, and provider-SDN per-node public IPs.",
    },
  },
  "distributed-failure-handling": {
    order: 1,
    title: {
      ko: "분산 환경의 실패 처리",
      en: "Failure Handling in Distributed Systems",
    },
    description: {
      ko: "결과가 불명확한 요청부터 Saga의 유지보수 비용, OpenStack와 Kubernetes의 조정 루프까지 분산 장애를 다루는 설계 원칙",
      en: "Design principles for ambiguous outcomes, Saga maintenance costs, and the reconciliation loops used by OpenStack and Kubernetes.",
    },
  },
  "domain-driven-design": {
    order: 2,
    title: {
      ko: "도메인 주도 설계",
      en: "Domain-Driven Design",
    },
    description: {
      ko: "문제 공간의 언어를 경계와 모델, 협업 방식으로 연결하는 글 모음",
      en: "Articles connecting problem-space language to boundaries, models, and collaboration.",
    },
  },
  "frontend-maintainability": {
    order: 3,
    title: {
      ko: "유지보수 가능한 Tailwind와 shadcn/ui",
      en: "Maintainable Tailwind and shadcn/ui",
    },
    description: {
      ko: "semantic token, primitive, 제품 composition과 page의 변경 권한을 분리하고 검증하는 네 가지 목적별 문서",
      en: "Four purpose-specific documents for separating and verifying semantic tokens, primitives, product compositions, and pages.",
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
