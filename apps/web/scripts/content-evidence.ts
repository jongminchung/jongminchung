import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DocMetadata } from "../lib/content-model.ts";

export type FreshnessPolicy =
  | "versioned-technology"
  | "upstream-api"
  | "evergreen-concept"
  | "imported-source";

const freshnessDays: Readonly<Record<FreshnessPolicy, number>> = {
  "versioned-technology": 90,
  "upstream-api": 120,
  "imported-source": 180,
  "evergreen-concept": 730,
};

export function freshnessPolicyFor(
  metadata: Pick<DocMetadata, "packageName" | "sourceUrl">,
): FreshnessPolicy {
  if (metadata.packageName !== undefined) return "versioned-technology";
  if (/github\.com\/kciter\/|kciter\.so\//u.test(metadata.sourceUrl))
    return "imported-source";
  if (/\/(docs?|api)(?:\/|$)/u.test(new URL(metadata.sourceUrl).pathname))
    return "upstream-api";
  return "evergreen-concept";
}

export interface FreshnessAssessment {
  readonly ageDays: number | null;
  readonly policy: FreshnessPolicy;
  readonly thresholdDays: number;
  readonly stale: boolean;
}

export function assessFreshness(
  metadata: Pick<DocMetadata, "packageName" | "sourceUrl" | "verifiedAt">,
  now: Date,
): FreshnessAssessment {
  const policy = freshnessPolicyFor(metadata);
  const thresholdDays = freshnessDays[policy];
  const ageDays =
    metadata.verifiedAt === undefined
      ? null
      : Math.floor(
          (now.getTime() -
            new Date(`${metadata.verifiedAt}T00:00:00Z`).getTime()) /
            86_400_000,
        );
  return Object.freeze({
    ageDays,
    policy,
    thresholdDays,
    stale: ageDays === null || ageDays > thresholdDays,
  });
}

type SourceResult = {
  readonly state:
    | "not-checked"
    | "ok"
    | "redirect"
    | "missing"
    | "temporary-failure";
  readonly status?: number;
  readonly destination?: string;
};

async function checkSource(url: string): Promise<SourceResult> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "jongminchung-content-evidence/1" },
    });
    const destination = response.headers.get("location") ?? undefined;
    if (response.status >= 300 && response.status < 400)
      return { state: "redirect", status: response.status, destination };
    if (response.status === 404 || response.status === 410)
      return { state: "missing", status: response.status };
    if (
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500
    )
      return { state: "temporary-failure", status: response.status };
    return { state: "ok", status: response.status };
  } catch {
    return { state: "temporary-failure" };
  }
}

export async function createEvidenceReport(
  now = new Date(),
  network = false,
): Promise<unknown> {
  const { readContentSnapshot } = await import("../lib/content-repository.ts");
  const documents = readContentSnapshot().documents;
  const sourceResults = new Map<string, SourceResult>();
  if (network) {
    const urls = [...new Set(documents.map(({ sourceUrl }) => sourceUrl))];
    for (let index = 0; index < urls.length; index += 5) {
      const batch = urls.slice(index, index + 5);
      const results = await Promise.all(batch.map(checkSource));
      batch.forEach((url, resultIndex) =>
        sourceResults.set(url, results[resultIndex]!),
      );
    }
  }
  const items = documents.map((metadata) => {
    const freshness = assessFreshness(metadata, now);
    const source = sourceResults.get(metadata.sourceUrl) ?? {
      state: "not-checked" as const,
    };
    const severity =
      source.state === "missing"
        ? "review-required"
        : freshness.stale ||
            source.state === "temporary-failure" ||
            source.state === "redirect"
          ? "warning"
          : "none";
    return {
      relativePath: `${metadata.locale}/${metadata.id}.mdx`,
      id: metadata.id,
      locale: metadata.locale,
      verifiedAt: metadata.verifiedAt ?? null,
      sourceUrl: metadata.sourceUrl,
      freshness,
      source,
      severity,
    };
  });
  return Object.freeze({
    generatedAt: now.toISOString(),
    networkChecked: network,
    summary: {
      documents: items.length,
      warnings: items.filter((item) => item.severity === "warning").length,
      reviewRequired: items.filter(
        (item) => item.severity === "review-required",
      ).length,
    },
    items,
  });
}

async function main(): Promise<void> {
  const network = process.argv.includes("--network");
  const outputFlag = process.argv.indexOf("--output");
  const output = outputFlag >= 0 ? process.argv[outputFlag + 1] : undefined;
  const report = `${JSON.stringify(await createEvidenceReport(new Date(), network), null, 2)}\n`;
  if (output !== undefined) await writeFile(resolve(output), report, "utf8");
  else process.stdout.write(report);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
