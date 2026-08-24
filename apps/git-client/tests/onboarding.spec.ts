import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?fixture=qa");
});

test("[성공] repository workflow guide를 dismiss하고 repository별 상태를 복원함", async ({
  page,
}) => {
  const guide = page.getByLabel("Git workflow guide", { exact: true });
  await expect(guide).toBeVisible();
  await expect(guide.getByText("First repository workflow")).toBeVisible();
  await expect(guide.getByText(/steps complete/)).toBeVisible();

  await guide
    .getByRole("button", { name: "Dismiss Git workflow guide" })
    .click();
  await expect(
    page.getByRole("button", { name: "Show Git workflow guide" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Show Git workflow guide" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Show Git workflow guide" }).click();
  await expect(guide).toBeVisible();
});
