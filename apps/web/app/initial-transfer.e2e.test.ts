import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

interface InitialTransferBudgetRoute {
  readonly site: "home" | "tech" | "invest";
  readonly locale: "en" | "ko";
  readonly url: string;
  readonly expectedFontFamily: string;
  readonly maxInitialFontTransferBytes: number;
  readonly maxInitialFontDecodedBytes: number;
  readonly maxInitialJavaScriptTransferBytes: number;
  readonly maxInitialJavaScriptDecodedBytes: number;
}

interface InitialTransferBudget {
  readonly routes: readonly InitialTransferBudgetRoute[];
}

const budget = JSON.parse(
  await readFile(
    resolve(import.meta.dirname, "../initial-transfer-budget.json"),
    "utf8",
  ),
) as InitialTransferBudget;

for (const route of budget.routes) {
  test(`initial transfer budget: ${route.site}/${route.locale}`, async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(route.url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const measurement = await page.evaluate(() => {
      const resources = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const sum = (
        entries: readonly PerformanceResourceTiming[],
        field: "transferSize" | "decodedBodySize",
      ): number => entries.reduce((total, entry) => total + entry[field], 0);
      const fonts = resources.filter((entry) =>
        new URL(entry.name).pathname.endsWith(".woff2"),
      );
      const scripts = resources.filter((entry) =>
        new URL(entry.name).pathname.endsWith(".js"),
      );

      return {
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontRequests: fonts.length,
        fontTransferBytes: sum(fonts, "transferSize"),
        fontDecodedBytes: sum(fonts, "decodedBodySize"),
        javaScriptRequests: scripts.length,
        javaScriptTransferBytes: sum(scripts, "transferSize"),
        javaScriptDecodedBytes: sum(scripts, "decodedBodySize"),
      };
    });

    expect(measurement.fontFamily).toContain(route.expectedFontFamily);
    expect(measurement.fontRequests).toBeGreaterThan(0);
    expect(measurement.fontTransferBytes).toBeLessThanOrEqual(
      route.maxInitialFontTransferBytes,
    );
    expect(measurement.fontDecodedBytes).toBeLessThanOrEqual(
      route.maxInitialFontDecodedBytes,
    );
    expect(measurement.javaScriptRequests).toBeGreaterThan(0);
    expect(measurement.javaScriptTransferBytes).toBeLessThanOrEqual(
      route.maxInitialJavaScriptTransferBytes,
    );
    expect(measurement.javaScriptDecodedBytes).toBeLessThanOrEqual(
      route.maxInitialJavaScriptDecodedBytes,
    );
    await context.close();
  });
}
