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
  readonly maxInitialStylesheetTransferBytes: number;
  readonly maxInitialStylesheetDecodedBytes: number;
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
    page,
  }, testInfo) => {
    const response = await page.goto(route.url, { waitUntil: "networkidle" });
    expect(response?.ok()).toBe(true);
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
      const stylesheets = resources.filter((entry) =>
        new URL(entry.name).pathname.endsWith(".css"),
      );

      return {
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontRequests: fonts.length,
        fontTransferBytes: sum(fonts, "transferSize"),
        fontDecodedBytes: sum(fonts, "decodedBodySize"),
        stylesheetRequests: stylesheets.length,
        stylesheetTransferBytes: sum(stylesheets, "transferSize"),
        stylesheetDecodedBytes: sum(stylesheets, "decodedBodySize"),
        javaScriptRequests: scripts.length,
        javaScriptTransferBytes: sum(scripts, "transferSize"),
        javaScriptDecodedBytes: sum(scripts, "decodedBodySize"),
      };
    });

    await testInfo.attach("initial-transfer.json", {
      body: JSON.stringify(measurement, null, 2),
      contentType: "application/json",
    });

    expect.soft(measurement.fontFamily).toContain(route.expectedFontFamily);
    expect.soft(measurement.fontRequests).toBeGreaterThan(0);
    expect
      .soft(measurement.fontTransferBytes)
      .toBeLessThanOrEqual(route.maxInitialFontTransferBytes);
    expect
      .soft(measurement.fontDecodedBytes)
      .toBeLessThanOrEqual(route.maxInitialFontDecodedBytes);
    expect.soft(measurement.stylesheetRequests).toBeGreaterThan(0);
    expect
      .soft(measurement.stylesheetTransferBytes)
      .toBeLessThanOrEqual(route.maxInitialStylesheetTransferBytes);
    expect
      .soft(measurement.stylesheetDecodedBytes)
      .toBeLessThanOrEqual(route.maxInitialStylesheetDecodedBytes);
    expect.soft(measurement.javaScriptRequests).toBeGreaterThan(0);
    expect
      .soft(measurement.javaScriptTransferBytes)
      .toBeLessThanOrEqual(route.maxInitialJavaScriptTransferBytes);
    expect
      .soft(measurement.javaScriptDecodedBytes)
      .toBeLessThanOrEqual(route.maxInitialJavaScriptDecodedBytes);
  });
}
