import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "../../e2e-assertions";

test("[성공] 접근성 환경에서도 문서 탐색과 focus 계약을 유지함", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "reduce",
  });
  await page.goto("/en/nextjs-16");

  await expectNoHorizontalOverflow(page);
  const trigger = page.getByRole("button", { name: "Search documentation" });
  await trigger.focus();
  await expect(trigger).toBeFocused();
  expect(
    await trigger.evaluate((element) => {
      const duration = getComputedStyle(element).transitionDuration;
      return Math.max(
        ...duration.split(",").map((value) => {
          const parsed = Number.parseFloat(value);
          return value.trim().endsWith("ms") ? parsed : parsed * 1_000;
        }),
      );
    }),
  ).toBeLessThanOrEqual(0.1);

  await trigger.click();
  const search = page.getByRole("dialog", { name: "Search documentation" });
  await expect(search).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
});
