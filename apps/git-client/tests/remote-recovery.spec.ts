import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?fixture=qa");
});

test("keeps Push keyboard-safe through exact lease confirmation and Escape", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Push…", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Push" });
  await expect(dialog.getByLabel("Remote", { exact: true })).toBeFocused();

  await dialog.getByLabel("Destination branch").fill("refs/heads/diverged");
  await dialog.getByRole("button", { name: "Review destination" }).click();
  await dialog.getByRole("radio", { name: /Force push with lease/ }).check();
  const confirmation = dialog.getByLabel(/confirm force push with lease/);
  await expect(confirmation).toBeFocused();
  await confirmation.fill("diverged");
  await confirmation.press("Enter");
  await expect(dialog).toHaveCount(0);

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("focuses the first history rewrite action and dismisses with Escape", async ({ page }) => {
  await page
    .getByRole("row", {
      name: /Jamie 2 hours ago refactor: isolate credential redaction/,
    })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Interactive Rebase from Here…" }).click();
  const dialog = page.getByRole("dialog", { name: "History Rewrite" });
  await expect(dialog.getByLabel(/Action for/).first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
