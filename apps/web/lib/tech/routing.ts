import {
  createDocsPageHref,
  type DocsArea,
  type Locale,
} from "../content-model.ts";
import type { SeriesId } from "./series.ts";

export const docsAreaBySeries: Readonly<Record<SeriesId, DocsArea>> = {
  "frontend-maintainability": "fe",
  "cilium-gateway-api": "k8s",
  "domain-driven-design": "architecture",
  "distributed-failure-handling": "architecture",
};

/** 과거 Series URL의 단일 308 목적지를 반환함 */
export function docsOverviewForSeries(
  locale: Locale,
  series?: SeriesId,
): string {
  if (series === undefined) return createDocsPageHref(locale);
  return createDocsPageHref(locale, docsAreaBySeries[series], series);
}
