import {
  createDocsPageHref,
  type DocsArea,
  type Locale,
} from "../content-model.ts";

export const legacyDocsSeriesIds = [
  "cilium-gateway-api",
  "distributed-failure-handling",
  "domain-driven-design",
  "frontend-maintainability",
  "vscode-format-and-lint",
] as const;
export type LegacyDocsSeriesId = (typeof legacyDocsSeriesIds)[number];

const docsOverviewByLegacySeries: Readonly<
  Record<LegacyDocsSeriesId, readonly [DocsArea, string?]>
> = {
  "cilium-gateway-api": ["k8s", "cilium-gateway-api"],
  "distributed-failure-handling": ["be", "distributed-failure-handling"],
  "domain-driven-design": ["be", "domain-driven-design"],
  "frontend-maintainability": ["fe", "frontend-maintainability"],
  "vscode-format-and-lint": ["vscode"],
};

const legacyVscodeArticles: Readonly<Record<string, string>> = {
  "vscode-editorconfig": "editorconfig",
  "vscode-oxfmt-oxlint": "oxfmt-oxlint",
  "vscode-yaml": "yaml",
  "vscode-shell": "shell",
  "vscode-go": "go-format",
  "vscode-ruff": "ruff",
  "vscode-tasks-ci": "tasks-ci",
};

/** 이전 VS Code 블로그 주소를 Docs의 canonical 주소로 연결함 */
export function legacyVscodeArticleHref(
  locale: Locale,
  id: string,
): string | null {
  const slug = Object.hasOwn(legacyVscodeArticles, id)
    ? legacyVscodeArticles[id]
    : undefined;
  return slug === undefined ? null : createDocsPageHref(locale, "vscode", slug);
}

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
