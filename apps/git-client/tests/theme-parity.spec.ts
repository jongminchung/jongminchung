import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loadThemeParityContract, resolveThemeColors } from "../scripts/parity/theme-contract.mjs";
import {
  compareVisuals,
  MAXIMUM_MISMATCH_PERCENT,
  MINIMUM_STRUCTURAL_SSIM,
} from "../scripts/parity/visual-compare.mjs";

const appRoot = resolve(import.meta.dirname, "..");
const reportRoot = resolve(appRoot, "test-results/theme-parity");
const contract = loadThemeParityContract();
const expectedThemes = resolveThemeColors(contract);
const themeModes = ["light", "dark"] as const;

function channel(value: string): number {
  return Number.parseInt(value, 16);
}

function rgba(value: string): readonly number[] {
  if (value === "transparent") return [0, 0, 0, 0];
  return [
    channel(value.slice(1, 3)),
    channel(value.slice(3, 5)),
    channel(value.slice(5, 7)),
    value.length === 9 ? channel(value.slice(7, 9)) : 255,
  ];
}

async function installThemeSwatches(page: Page, mode: (typeof themeModes)[number]): Promise<void> {
  const colors = expectedThemes[mode];
  await page.evaluate(
    ({ expected, theme }) => {
      document.documentElement.dataset.theme = theme;
      for (const id of ["theme-parity-expected", "theme-parity-candidate"]) {
        document.getElementById(id)?.remove();
      }
      const createStrip = (id: string, source: "expected" | "candidate"): HTMLDivElement => {
        const strip = document.createElement("div");
        strip.id = id;
        Object.assign(strip.style, {
          background: "white",
          display: "grid",
          gridTemplateColumns: "repeat(8, 24px)",
          left: "0",
          padding: "8px",
          position: "fixed",
          top: "0",
          zIndex: "2147483647",
        });
        for (const [token, color] of Object.entries(expected)) {
          const swatch = document.createElement("span");
          swatch.dataset.token = token;
          swatch.style.background = source === "expected" ? color : `var(--${token})`;
          swatch.style.height = "24px";
          swatch.style.width = "24px";
          strip.append(swatch);
        }
        document.body.append(strip);
        return strip;
      };
      createStrip("theme-parity-expected", "expected");
      createStrip("theme-parity-candidate", "candidate");
    },
    { expected: colors, theme: mode },
  );
}

async function resolvedTokenPixels(
  page: Page,
): Promise<Readonly<Record<string, readonly number[]>>> {
  return page.locator("#theme-parity-candidate").evaluate((strip) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Theme parity requires a 2D canvas context");
    return Object.fromEntries(
      [...strip.children].map((child) => {
        const swatch = child as HTMLElement;
        const token = swatch.dataset.token;
        if (token === undefined) throw new Error("Theme parity swatch is missing its token name");
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = getComputedStyle(swatch).backgroundColor;
        context.fillRect(0, 0, 1, 1);
        return [token, [...context.getImageData(0, 0, 1, 1).data]];
      }),
    );
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?fixture=qa");
});

for (const mode of themeModes) {
  test(`matches Rebased Islands ${mode} semantic colors in browser sRGB`, async ({ page }) => {
    await installThemeSwatches(page, mode);
    const actual = await resolvedTokenPixels(page);
    for (const [token, color] of Object.entries(expectedThemes[mode])) {
      const expected = rgba(color);
      const observed = actual[token];
      expect(observed, `${mode} --${token}`).toBeDefined();
      for (let index = 0; index < expected.length; index += 1) {
        expect(
          Math.abs((observed?.[index] ?? Number.NaN) - (expected[index] ?? Number.NaN)),
          `${mode} --${token} channel ${index}`,
        ).toBeLessThanOrEqual(contract.thresholds.maximumChannelDelta);
      }
    }

    mkdirSync(reportRoot, { recursive: true });
    const referenceName = `${mode}-expected.png`;
    const candidateName = `${mode}-candidate.png`;
    await page
      .locator("#theme-parity-expected")
      .screenshot({ path: resolve(reportRoot, referenceName) });
    await page
      .locator("#theme-parity-candidate")
      .screenshot({ path: resolve(reportRoot, candidateName) });
    const comparison = await compareVisuals({
      parityRoot: reportRoot,
      referencePath: referenceName,
      candidatePath: candidateName,
      outputPath: `${mode}-report.json`,
    });
    expect(comparison.metrics.structuralSsim).toBeGreaterThanOrEqual(
      contract.thresholds.minimumStructuralSsim,
    );
    expect(comparison.metrics.mismatchPercent).toBeLessThanOrEqual(
      contract.thresholds.maximumMismatchPercent,
    );
  });
}

test("keeps visual thresholds synchronized with the parity comparator", () => {
  expect(contract.thresholds.minimumStructuralSsim).toBe(MINIMUM_STRUCTURAL_SSIM);
  expect(contract.thresholds.maximumMismatchPercent).toBe(MAXIMUM_MISMATCH_PERCENT);
});

test("matches Rebased geometry, density, and interactive states", async ({ page }) => {
  const toolbar = page.getByRole("banner", { name: "Main Toolbar" });
  const logTabs = page.getByRole("tablist", { name: "Log" }).locator("..");
  const statusBar = page.getByRole("contentinfo", { name: "Status Bar" });
  await expect(toolbar).toHaveCSS("height", `${contract.geometry.mainToolbar}px`);
  await expect(logTabs).toHaveCSS("height", `${contract.geometry.logTab}px`);
  await expect(statusBar).toHaveCSS("height", `${contract.geometry.statusBar}px`);

  await page.locator("html").evaluate((root) => {
    root.dataset.compact = "true";
  });
  const commitRow = page.getByRole("row").nth(1);
  await expect(commitRow).toHaveCSS("height", `${contract.geometry.compactRow}px`);

  const appearance = page.getByRole("button", { name: /Appearance:/u });
  await appearance.click();
  const selected = page.getByRole("radio", { name: "Islands Light", exact: true });
  const other = page.getByRole("radio", { name: "Islands Dark", exact: true });
  await expect(selected).toHaveAttribute("aria-checked", "true");
  const selectedBackground = await selected
    .locator("span")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const primary = await page
    .locator("html")
    .evaluate((root) => getComputedStyle(root).getPropertyValue("--primary").trim());
  expect(selectedBackground).toBe(primary);

  const otherRow = other.locator("..");
  const idleBackground = await otherRow.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await otherRow.hover();
  await expect
    .poll(() => otherRow.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(idleBackground);
  await page.keyboard.press("End");
  await expect(other).toBeFocused();
  expect(
    await other.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    }),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await page.mouse.move(0, 200);
  const idleActionBackground = await appearance.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await appearance.hover();
  await page.mouse.down();
  const activeActionBackground = await appearance.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await page.mouse.up();
  expect(activeActionBackground).not.toBe(idleActionBackground);

  const disabledColor = await page.evaluate(() => {
    const fixture = document.createElement("button");
    fixture.className = "text-disabled-foreground disabled:opacity-45";
    fixture.disabled = true;
    document.body.append(fixture);
    const style = getComputedStyle(fixture);
    return { color: style.color, opacity: style.opacity };
  });
  const expectedDisabledColor = await page
    .locator("html")
    .evaluate((root) => getComputedStyle(root).getPropertyValue("--disabled-foreground").trim());
  expect(disabledColor).toEqual({ color: expectedDisabledColor, opacity: "0.45" });
});

test("keeps approved Light and Dark screen states stable", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 650 });
  await page.goto("/?fixture=welcome-recent");
  await expect(page).toHaveScreenshot("theme-parity-welcome-light.png", {
    maxDiffPixelRatio: contract.thresholds.maximumMismatchPercent / 100,
  });

  await page.setViewportSize({ width: 1184, height: 768 });
  await page.goto("/?fixture=qa");
  await page.getByRole("button", { name: /Appearance:/u }).click();
  await page.getByRole("radio", { name: "Islands Dark", exact: true }).click();
  await expect(page).toHaveScreenshot("theme-parity-workbench-dark.png", {
    maxDiffPixelRatio: contract.thresholds.maximumMismatchPercent / 100,
  });

  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(page.getByText("Native Terminal", { exact: true }).locator("..")).toHaveScreenshot(
    "theme-parity-terminal-dark.png",
    { maxDiffPixelRatio: contract.thresholds.maximumMismatchPercent / 100 },
  );
});
