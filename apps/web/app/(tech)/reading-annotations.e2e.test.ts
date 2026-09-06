import { expect, test } from "@playwright/test";
import {
  expectNoAccessibilityViolations,
  expectNoHorizontalOverflow,
} from "../../e2e-assertions";

for (const theme of ["light", "dark"] as const) {
  for (const forcedColors of ["none", "active"] as const) {
    test(`읽기 주석: ${theme}, 고대비 ${forcedColors}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ forcedColors });
      await page.addInitScript(
        (value) => localStorage.setItem("tech-theme", value),
        theme,
      );
      await page.goto("/fixtures/reading-annotations");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("note")).toHaveCount(5);
      await expect(page.locator("mark")).toHaveCSS(
        "box-decoration-break",
        "clone",
      );
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await expectNoAccessibilityViolations(page, "main");
      await page.screenshot({
        path: testInfo.outputPath("reading.png"),
        fullPage: true,
      });
      await page
        .getByRole("link", { name: "자세한 내용", exact: true })
        .first()
        .focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#details$/u);
    });
  }
}
