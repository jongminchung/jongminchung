import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?fixture=qa");
});

test("keeps the normal browser start screen free of repository fixtures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Manage", exact: true })).toBeVisible();
  await expect(page.getByText("Browser preview has no native Git bridge")).toBeVisible();
  await expect(page.getByRole("region", { name: "Commit log" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open QA fixture" })).toHaveAttribute(
    "href",
    "/?fixture=qa",
  );
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

test("keeps Manage fixed and separates Git Console from the native Terminal", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Manage", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(page.getByText("Native Terminal")).toBeVisible();
  await expect(page.getByText("The QA fixture does not start a shell.")).toBeVisible();
  await page.getByRole("button", { name: "Git Console", exact: true }).click();
  await expect(
    page.getByText("Git commands and credential-redacted output appear here."),
  ).toBeVisible();
});

test("opens a read-only file viewer from local changes", async ({ page }) => {
  await page.getByRole("button", { name: "Commit 5" }).click();
  const viewButton = page.getByRole("button", { name: "View src-tauri/src/git.rs", exact: true });
  await viewButton.click();
  await expect(page.getByRole("dialog")).toContainText("Working Tree");
  await expect(page.locator(".cm-editor")).toBeVisible();
  await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
});

test("has no serious automated accessibility violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
