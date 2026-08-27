import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/fixtures/ui-primitives");
  await expect(
    page.getByRole("heading", { name: "Shared UI interaction fixture" }),
  ).toBeVisible();
});

test("[성공] Dialog를 닫은 뒤 trigger focus를 복원함", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Open dialog" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Shared dialog" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("[성공] Select를 keyboard로 탐색하고 값을 확정함", async ({ page }) => {
  const trigger = page.getByRole("combobox", { name: "Fixture branch" });
  await trigger.focus();
  await trigger.press("ArrowDown");

  const listbox = page
    .getByRole("listbox")
    .filter({ has: page.getByRole("option", { name: "Alpha" }) });
  await expect(listbox).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(listbox).toBeHidden();
  await expect(trigger).toContainText("beta");
  await expect(trigger).toBeFocused();
});

test("[성공] Menu를 Escape로 닫고 trigger focus를 복원함", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Open actions" });
  await trigger.focus();
  await trigger.press("ArrowDown");

  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Open repository" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("[성공] Command active descendant를 option과 연결함", async ({ page }) => {
  const input = page.getByRole("combobox", { name: "Filter commands" });
  await input.focus();
  await input.press("ArrowDown");

  const activeId = await input.getAttribute("aria-activedescendant");
  expect(activeId).not.toBeNull();
  const activeOption = page.locator(`[id="${activeId}"]`);
  await expect(activeOption).toHaveRole("option");
  await input.press("Enter");

  await expect(page.getByRole("status")).toHaveText(/Selected:/u);
});
