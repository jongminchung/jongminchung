import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

export const QA_EVIDENCE_DIR = path.resolve(process.cwd(), "test-results/qa-evidence");

function cleanSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function captureQaScreenshot(
  testInfo: TestInfo,
  page: Page,
  scenario: string,
  fileName: string,
  options: { readonly fullPage?: boolean } = {},
): Promise<string> {
  const relativePath = path.join("screenshots", cleanSegment(scenario), fileName);
  const absolutePath = path.join(QA_EVIDENCE_DIR, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await page.screenshot({ fullPage: options.fullPage ?? true, path: absolutePath });
  await testInfo.attach(relativePath, { contentType: "image/png", path: absolutePath });
  return path.relative(process.cwd(), absolutePath);
}
