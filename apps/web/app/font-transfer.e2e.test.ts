import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

interface FontBudgetRoute {
  readonly site: "home" | "tech" | "invest";
  readonly locale: "en" | "ko";
  readonly url: string;
  readonly maxInitialFontBytes: number;
}

interface FontBudget {
  readonly routes: readonly FontBudgetRoute[];
}

const budget = JSON.parse(
  await readFile(resolve(import.meta.dirname, "../font-budget.json"), "utf8"),
) as FontBudget;

for (const route of budget.routes) {
  test(`font budget: ${route.site}/${route.locale}`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const fontResponses: Promise<number>[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "font") {
        fontResponses.push(response.body().then((body) => body.byteLength));
      }
    });

    await page.goto(route.url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const fontBytes = (await Promise.all(fontResponses)).reduce(
      (sum, bytes) => sum + bytes,
      0,
    );

    expect(fontBytes).toBeLessThanOrEqual(route.maxInitialFontBytes);
    expect(fontResponses).toHaveLength(route.locale === "ko" ? 1 : 0);
    await context.close();
  });
}
