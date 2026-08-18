import { expect, test } from "@playwright/test";

const cases = [
    {
        name: "investment-wide-light",
        width: 1440,
        height: 1000,
        theme: "light",
    },
    { name: "investment-mobile-dark", width: 390, height: 844, theme: "dark" },
] as const;

for (const visualCase of cases) {
    test(`visual: ${visualCase.name}`, async ({ page }) => {
        await page.setViewportSize({
            width: visualCase.width,
            height: visualCase.height,
        });
        await page.addInitScript(
            (theme) => localStorage.setItem("invest-theme", theme),
            visualCase.theme,
        );
        await page.goto("/en");
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${visualCase.name}.png`, {
            fullPage: true,
        });
    });
}
