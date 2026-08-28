import { createDocsPageHref, type Locale } from "../content-model.ts";

export const legacyDocsSeriesIds = [
  "cilium-gateway-api",
  "distributed-failure-handling",
  "domain-driven-design",
  "frontend-maintainability",
] as const;
export type LegacyDocsSeriesId = (typeof legacyDocsSeriesIds)[number];

const docsOverviewByLegacySeries: Readonly<
  Record<LegacyDocsSeriesId, readonly ["fe" | "be" | "k8s", string]>
> = {
  "cilium-gateway-api": ["k8s", "cilium-gateway-api"],
  "distributed-failure-handling": ["be", "distributed-failure-handling"],
  "domain-driven-design": ["be", "domain-driven-design"],
  "frontend-maintainability": ["fe", "frontend-maintainability"],
};

/** 해체된 Docs Series 식별자를 판별함 */
export function isLegacyDocsSeriesId(
  value: string,
): value is LegacyDocsSeriesId {
  return legacyDocsSeriesIds.includes(value as LegacyDocsSeriesId);
}

/** 과거 Series URL의 단일 308 목적지를 반환함 */
export function docsOverviewForSeries(
  locale: Locale,
  series: LegacyDocsSeriesId,
): string {
  const [area, slug] = docsOverviewByLegacySeries[series];
  return createDocsPageHref(locale, area, slug);
}
