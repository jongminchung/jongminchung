import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the dense three-pane Git log fixture", async ({ page }) => {
  await expect(page.getByRole("complementary", { name: "Branches and tags" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Commit log" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Commit details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Commit 5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check for updates" })).toHaveCount(0);
  await expect(page).toHaveScreenshot("git-log-workbench.png", { fullPage: true });
});

test("shares action availability with the commit context menu", async ({ page }) => {
  const head = page.getByRole("button", {
    name: "Jongmin Chung now main origin/main feat: add workspace-aware repository sessions 0000000",
    exact: true,
  });
  await head.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Copy Revision Number ⌥⇧⌘C" })).toBeEnabled();
  await expect(page.getByRole("menuitem", { name: "Cherry-Pick" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "Push All up to Here…" })).toBeEnabled();
});

test("lazy-loads the CodeMirror merge view", async ({ page }) => {
  await page
    .getByRole("button", { name: "M src/components/CommitLog.tsx +38 −9", exact: true })
    .dblclick();
  await expect(
    page.getByRole("dialog", { name: "Diff for src/components/CommitLog.tsx" }),
  ).toBeVisible();
  await expect(page.locator(".cm-mergeView")).toBeVisible();
});

test("offers open, clone, and initialize repository flows", async ({ page }) => {
  await page.getByRole("button", { name: "Add repository" }).click();
  const dialog = page.getByRole("dialog", { name: "Add repository" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Clone" }).click();
  await expect(dialog.getByText("Remote URL")).toBeVisible();
  await dialog.getByRole("button", { name: "Initialize" }).click();
  await expect(dialog.getByText("Bare repository")).toBeVisible();
});

test("has no serious automated accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
