import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Locator } from "@playwright/test";

test.describe.configure({ mode: "parallel" });
const externalRequests = new WeakMap<Page, string[]>();

async function verifyAppearanceMatrix(page: Page, surface: Locator): Promise<void> {
  for (const theme of ["light", "dark"] as const) {
    for (const density of ["regular", "compact"] as const) {
      await page.locator("html").evaluate(
        (root, state) => {
          root.dataset.theme = state.theme;
          root.dataset.appearanceMode = state.theme;
          if (state.density === "compact") root.dataset.compact = "true";
          else delete root.dataset.compact;
        },
        { density, theme },
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect
        .poll(() =>
          page
            .locator("html")
            .evaluate((root) => getComputedStyle(root).getPropertyValue("--background").trim()),
        )
        .not.toBe("");
      await expect(surface).toBeVisible();
    }
  }
}

test.beforeEach(async ({ page }) => {
  const observed: string[] = [];
  externalRequests.set(page, observed);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "127.0.0.1") {
      observed.push(url.href);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  expect(externalRequests.get(page) ?? []).toEqual([]);
});

test("[parity:shell.welcome] exposes the canonical Welcome and Open flow", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 650 });
  await page.goto("/?fixture=welcome-recent");

  await expect(page).toHaveTitle("Welcome to Git Client");
  await expect(page.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  await expect(page.getByTestId("welcome-sidebar")).toHaveCSS("width", "225px");
  await expect(page.getByTestId("welcome-titlebar")).toHaveCSS("height", "27px");
  await verifyAppearanceMatrix(page, page.getByRole("region", { name: "Projects" }));
  await page.getByRole("treeitem", { name: "Projects" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("treeitem", { name: "Customize" })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("[parity:shell.project-log] selects a commit and opens its review surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1184, height: 768 });
  await page.goto("/?fixture=qa");

  await expect(page.getByRole("banner", { name: "Main Toolbar" })).toHaveCSS("height", "30px");
  await expect(page.getByRole("region", { name: "Commit log" })).toBeVisible();
  await verifyAppearanceMatrix(page, page.getByRole("region", { name: "Commit log" }));
  await page
    .getByRole("row", {
      name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/u,
    })
    .click();
  await expect(page.getByRole("navigation", { name: "Changed files" })).toBeVisible();
  await expect(page.getByText("Commit details", { exact: true })).toBeVisible();
});

test("[parity:changes.commit-tool-window] exposes deterministic stage and commit states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1184, height: 768 });
  await page.goto("/?fixture=qa");
  await page.getByRole("button", { name: "Commit", exact: true }).click();

  await expect(page.getByRole("complementary", { name: "Changed files" })).toBeVisible();
  await verifyAppearanceMatrix(page, page.getByRole("complementary", { name: "Changed files" }));
  const unstage = page.getByRole("button", { name: "Unstage selected" });
  await expect(unstage).toBeVisible();
  await unstage.focus();
  await expect(unstage).toBeFocused();
  await expect(page.getByLabel("Commit message")).toBeVisible();
});

test("[parity:platform.terminal] keeps the browser fixture shell-free and focusable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1184, height: 768 });
  await page.goto("/?fixture=qa");
  const terminal = page.getByRole("button", { name: "Terminal", exact: true });
  await terminal.click();

  const surface = page.getByText("Native Terminal", { exact: true }).locator("..");
  await expect(surface).toContainText("The deterministic QA fixture does not start a shell.");
  await expect(surface).toHaveCSS("display", "flex");
  await verifyAppearanceMatrix(page, surface);
  await page.keyboard.press("Escape");
  await expect(terminal).toBeVisible();
});
