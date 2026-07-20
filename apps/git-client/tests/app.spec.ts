import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?fixture=qa");
});

test("matches the 800 by 650 Rebased recent-project geometry", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 650 });
  await page.goto("/?fixture=welcome-recent");
  await expect(page).toHaveTitle("Welcome to Git Client");
  await expect(page.getByRole("textbox", { name: "Search projects" })).toBeVisible();
  await expect(page.getByRole("option", { name: /gcloud-cloudlog/ })).toContainText(
    "feat/opensearch",
  );
  await expect(page.getByRole("button", { name: "New Project" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("welcome-sidebar")).toHaveCSS("width", "225px");
  await expect(page.getByTestId("welcome-titlebar")).toHaveCSS("height", "27px");
  await expect(page.getByTestId("welcome-project-toolbar")).toHaveCSS("height", "68px");
  await expect(page).toHaveScreenshot("welcome-projects-light-recent-800x650.png");

  const search = page.getByRole("textbox", { name: "Search projects" });
  await search.fill("opensearch");
  await expect(page.getByRole("option", { name: /gcloud-cloudlog/ })).toBeVisible();
  await search.fill("missing-project");
  await expect(page.getByRole("option")).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByText("gcloud-cloudlog")).toHaveCount(0);
});

test("keeps the Rebased empty-project state at 800 by 650", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 650 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to Git Client" })).toBeVisible();
  await expect(page).toHaveScreenshot("welcome-projects-light-empty-800x650.png");
});

test("matches the focused Rebased Customize geometry", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 650 });
  await page.goto("/");
  await page.getByRole("treeitem", { name: "Projects" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("treeitem", { name: "Customize" })).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await expect(page.getByLabel("Theme:")).toHaveValue("light");
  await expect(page.getByText("Plugins", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Editor color scheme", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Language and Region", { exact: true })).toHaveCount(0);
  await page.getByLabel("Theme:").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByLabel("Theme:")).toBeFocused();
  await expect(page).toHaveScreenshot("welcome-customize-light-focused-800x650.png");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("applies and restores Welcome appearance preferences", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("treeitem", { name: "Customize" }).click();
  const root = page.locator("html");
  const theme = page.getByLabel("Theme:");
  const syncWithOs = page.getByRole("checkbox", { name: "Sync with OS" });

  await theme.selectOption("dark");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-appearance-mode", "dark");
  await expect(root).toHaveCSS("color-scheme", "dark");
  await page.reload();
  await page.getByRole("treeitem", { name: "Customize" }).click();
  await expect(theme).toHaveValue("dark");
  await expect(root).toHaveAttribute("data-theme", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await syncWithOs.check();
  await expect(theme).toHaveValue("light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("data-appearance-mode", "system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(theme).toHaveValue("dark");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(theme).toHaveValue("light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await syncWithOs.uncheck();
  await expect(theme).toHaveValue("light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("data-appearance-mode", "light");
  await expect(root).toHaveCSS("color-scheme", "light");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("git-client.appearance-mode")))
    .toBe('{"theme":"light","syncWithOs":false}');

  await page.reload();
  await page.getByRole("treeitem", { name: "Customize" }).click();
  await expect(theme).toHaveValue("light");
  await expect(syncWithOs).not.toBeChecked();
  await expect(root).toHaveAttribute("data-theme", "light");
});

test("keeps the workspace titlebar at 30px", async ({ page }) => {
  await expect(page.getByRole("banner", { name: "Main Toolbar" })).toHaveCSS("height", "30px");
});

test("renders the dense three-pane Git log fixture", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("complementary", { name: "Branches and tags" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Commit log" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Revision review" })).toBeVisible();
  await expect(page.getByText("Select commit to view changes")).toBeVisible();
  await page
    .getByRole("row", {
      name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
    })
    .click();
  await expect(page.getByRole("navigation", { name: "Changed files" })).toBeVisible();
  await expect(page.getByText("Commit details", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Local-only commit to push")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check for updates" })).toHaveCount(0);
  await expect(page).toHaveScreenshot("git-log-workbench.png", {
    fullPage: true,
  });
});

test("renders the Codex neutral dark theme", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /Appearance:/ }).click();
  await page.getByRole("radio", { name: "Islands Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page).toHaveScreenshot("git-log-workbench-dark.png", {
    fullPage: true,
  });
});

test("supports persisted Sync with OS, Islands Light, and Islands Dark modes", async ({ page }) => {
  const appearance = page.getByRole("button", { name: /Appearance:/ });

  await appearance.click();
  await page.getByRole("radio", { name: "Islands Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(appearance).toHaveAttribute("aria-label", "Appearance: Islands Dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(appearance).toHaveAttribute("aria-label", "Appearance: Islands Dark");

  await appearance.click();
  await page.getByRole("radio", { name: "Islands Light", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await appearance.click();
  await page.getByRole("radio", { name: "Sync with OS", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("navigates the Appearance menu with the keyboard", async ({ page }) => {
  const appearance = page.getByRole("button", { name: /Appearance:/ });
  await appearance.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Appearance" })).toBeVisible();
  await expect(page).toHaveScreenshot("appearance-menu.png", {
    fullPage: true,
  });
  await page.keyboard.press("End");
  await expect(page.getByRole("radio", { name: "Islands Dark", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(appearance).toHaveAttribute("aria-label", "Appearance: Islands Dark");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Appearance" })).toHaveCount(0);
  await expect(appearance).toBeFocused();
});

test("keeps core panes usable at the minimum window size", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 640 });
  await expect(page.getByRole("complementary", { name: "Branches and tags" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Branches" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Commit log" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Revision review" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await expect(page).toHaveScreenshot("git-log-workbench-minimum.png", {
    fullPage: true,
  });
});

test("uses an in-app validated dialog for history rewrites", async ({ page }) => {
  const head = page.getByRole("row", {
    name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
  });
  await head.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Reword Commit…" }).click();
  const dialog = page.getByRole("dialog", { name: "Reword commit" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("New commit message").fill("");
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(dialog.getByLabel("New commit message")).toHaveAttribute("required", "");
  await expect(dialog).toBeVisible();
});

test("shares action availability with the commit context menu", async ({ page }) => {
  const head = page.getByRole("row", {
    name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
  });
  await head.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: /Copy Revision Number.*⌥⇧⌘C/ })).toBeEnabled();
  await expect(page.getByRole("menuitem", { name: "Cherry-Pick" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "Push All up to Here…" })).toBeEnabled();
});

test("selects the first changed file and keeps commit details inline", async ({ page }) => {
  await page
    .getByRole("row", {
      name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
    })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Changed files" }).getByRole("button").first(),
  ).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("Commit details", { exact: true })).toBeVisible();
});

test("opens a file navigator automatically for exactly two revisions", async ({ page }) => {
  await page
    .getByRole("row", {
      name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
    })
    .click();
  await page
    .getByRole("row", { name: /Suh Junmin.*fix\(graph\)/ })
    .first()
    .click({ modifiers: ["Meta"] });
  await expect(page.getByRole("complementary", { name: "Revision comparison" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Compared files" })).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Diff for src/domain/actionAvailability.ts",
    }),
  ).toBeVisible();
});

test("opens Changes with the first layer selected and restores selection after staging", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Commit", exact: true }).click();
  await expect(
    page.getByRole("region", {
      name: "Diff for src/domain/actionAvailability.ts",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: /M git-service\.ts electron\/utility\/git \+22 −9/,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Diff for electron/utility/git/git-service.ts",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Stage file" })).toBeVisible();
});

test("opens one reviewed Push dialog and requires exact lease confirmation", async ({ page }) => {
  await page.getByRole("button", { name: "Push…", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Push" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Normal push/ })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: /Force push with lease/ })).toBeDisabled();

  await dialog.getByLabel("Destination branch").fill("refs/heads/diverged");
  await dialog.getByRole("button", { name: "Review destination" }).click();
  await expect(dialog.getByText("Diverged / rewritten", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Normal push/ })).toBeDisabled();
  await dialog.getByRole("radio", { name: /Force push with lease/ }).check();
  await expect(dialog.getByRole("button", { name: "Force Push with Lease" })).toBeDisabled();
  await dialog.getByLabel(/Type diverged to confirm/).fill("diverged");
  await expect(dialog.getByRole("button", { name: "Force Push with Lease" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Push…", exact: true }).click();
  const reopened = page.getByRole("dialog", { name: "Push" });
  await expect(reopened.getByRole("radio", { name: /Normal push/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(reopened).toHaveCount(0);
  await page.keyboard.press("Meta+Shift+p");
  await expect(page.getByRole("dialog", { name: "Push" })).toBeVisible();
});

test("opens published commits in the visual interactive rebase workspace", async ({ page }) => {
  const commit = page.getByRole("row", {
    name: /Jamie 2h ago refactor: isolate credential redaction/,
  });
  await commit.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Interactive Rebase from Here…" }).click();
  const dialog = page.getByRole("dialog", { name: "History Rewrite" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("2 published commit(s)", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Published", { exact: true })).toHaveCount(2);

  const rows = dialog.locator("tr[data-rebase-oid]");
  await expect(rows).toHaveCount(3);
  const firstOid = await rows.first().getAttribute("data-rebase-oid");
  await rows.first().dragTo(rows.nth(2));
  await expect(rows.first()).not.toHaveAttribute("data-rebase-oid", firstOid ?? "");
  await dialog
    .getByLabel(/Action for/)
    .first()
    .selectOption("reword");
  await expect(dialog.getByLabel(/New message for/).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Start Rebase" }).click();
  await expect(dialog.getByText("History rewrite completed", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Push…" }).click();
  const push = page.getByRole("dialog", { name: "Push" });
  await expect(push).toBeVisible();
  await expect(push.getByRole("radio", { name: /Normal push/ })).toBeChecked();
});

test("offers open, clone, and initialize repository flows", async ({ page }) => {
  await page.getByRole("button", { name: /Project:/ }).click();
  await page.getByRole("button", { name: "Clone Repository…" }).click();
  const dialog = page.getByRole("dialog", { name: "Repository" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Clone" })).toBeChecked();
  await expect(dialog.getByText("Remote URL")).toBeVisible();
  await dialog.getByRole("button", { name: "Clone", exact: true }).click();
  await expect(dialog.getByText("Enter a remote URL.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Enter a repository directory.", { exact: true })).toBeVisible();
  await dialog.getByLabel("Remote URL").fill("https://example.invalid/repository.git");
  await dialog.getByLabel("Empty destination").fill("/tmp/fixture-clone");
  await dialog.getByRole("button", { name: "Clone", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Real repository actions are disabled while the QA fixture is active.",
  );
  await dialog.getByRole("radio", { name: "Initialize" }).click();
  await expect(dialog.getByText("Bare repository")).toBeVisible();
});

test("keeps the browser fixture terminal shell-free", async ({ page }) => {
  await expect(page.getByRole("dialog", { name: "Repository Management" })).toHaveCount(0);
  const terminalTab = page.getByRole("button", {
    name: "Terminal",
    exact: true,
  });
  await terminalTab.click();

  const emptyTerminal = page.getByText("Native Terminal", { exact: true }).locator("..");
  await expect(emptyTerminal).toContainText("The deterministic QA fixture does not start a shell.");
  await expect(emptyTerminal).toHaveCSS("display", "flex");
  await expect(emptyTerminal).toHaveCSS("flex-direction", "column");
  await expect(emptyTerminal).toHaveCSS("justify-content", "center");
  await expect(emptyTerminal).toHaveCSS("text-align", "center");
  await expect(page.getByRole("button", { name: "Local", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New terminal", exact: true })).toHaveCount(0);
});

test("keeps the repository workbench visible without a Manage tab", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Manage", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Commit log" })).toBeVisible();
  await expect(page.getByRole("banner", { name: "Main Toolbar" })).toBeVisible();
});

test("opens a Rebased-style project switcher and restores focus on dismiss", async ({ page }) => {
  const projectButton = page.getByRole("button", {
    name: "Project: git-client",
  });
  await projectButton.click();

  const popup = page.getByRole("dialog", { name: "Projects" });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("button", { name: "Open…" })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Open…" })).toBeFocused();
  await expect(popup.getByRole("button", { name: "Clone Repository…" })).toBeVisible();
  await expect(popup.getByText("Open Projects", { exact: true })).toBeVisible();
  await expect(popup.getByText("git-client", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Repository Management" })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(projectButton).toBeFocused();
});

test("keeps log filters and commit options available in compact popovers", async ({ page }) => {
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const authorFilter = page.getByRole("combobox", { name: "Author" });
  await expect(authorFilter).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Path" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(authorFilter).not.toBeVisible();

  await page.getByRole("button", { name: "Commit", exact: true }).click();
  await expect(
    page.getByRole("region", {
      name: "Diff for src/domain/actionAvailability.ts",
    }),
  ).toBeVisible();
  const commitOptions = page.getByRole("button", {
    name: "Commit options",
    exact: true,
  });
  await expect(commitOptions).toBeEnabled();
  await commitOptions.click();
  await expect(page.getByRole("checkbox", { name: "Commit tracked" })).toBeVisible();
});

test("resizes the bottom panel with accessible keyboard controls", async ({ page }) => {
  const separator = page.getByRole("separator", {
    name: "Resize bottom panel",
  });
  await expect(separator).toHaveAttribute("aria-valuenow", "240");
  await separator.focus();
  await page.keyboard.press("ArrowUp");
  await expect(separator).toHaveAttribute("aria-valuenow", "250");
  await page.keyboard.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", "160");
});

test("resizes and exposes v4 review panes with accessible separators", async ({ page }) => {
  const review = page.getByRole("separator", {
    name: "Resize revision review",
  });
  await expect(review).toHaveAttribute("aria-valuenow", "210");
  await review.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(review).toHaveAttribute("aria-valuenow", "222");

  await page.getByRole("button", { name: /Changes 5/ }).click();
  const navigator = page.getByRole("separator", {
    name: "Resize change navigator",
  });
  await navigator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(navigator).toHaveAttribute("aria-valuenow", "262");
});

test("routes branch operations to a focused repository tool", async ({ page }) => {
  await page
    .getByRole("banner", { name: "Main Toolbar" })
    .getByRole("button", { name: "main" })
    .click();
  const branchesPopup = page.getByRole("dialog", { name: "Git Branches" });
  await expect(branchesPopup).toBeVisible();
  await branchesPopup.getByRole("button", { name: "Branches Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Branches & Tags" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Repository Management" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close Branches & Tags" }).click();
  await expect(dialog).toHaveCount(0);
});

test("uses the command registry for palette, views, search, drawer, and settings", async ({
  page,
}) => {
  await expect(page.getByRole("region", { name: "Commit log" })).toBeVisible();
  await page.keyboard.press("Meta+2");
  await expect(
    page.getByRole("region", {
      name: "Diff for src/domain/actionAvailability.ts",
    }),
  ).toBeVisible();

  await page.keyboard.press("Meta+f");
  await expect(page.getByLabel("Filter changed files")).toBeFocused();
  await page.keyboard.press("Meta+Enter");
  await expect(page.locator("[data-command-status]")).toContainText(
    "Enter a commit message and stage at least one file.",
  );
  await page.keyboard.press("Meta+p");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  const paletteAccessibility = await new AxeBuilder({ page })
    .include('dialog[aria-label="Command palette"]')
    .disableRules(["color-contrast"])
    .analyze();
  expect(
    paletteAccessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
  await palette.getByRole("combobox").fill("Commit & Push");
  await expect(palette.getByRole("option", { name: /Commit & Push/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(palette.getByRole("option", { name: /Commit & Push/ })).toContainText(
    "Enter a commit message",
  );
  await palette.getByRole("combobox").fill("actionAvailability.ts");
  await expect(
    palette
      .getByRole("option", {
        name: /src\/domain\/actionAvailability\.ts/,
      })
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(page.getByLabel("Filter changed files")).toBeFocused();

  await page.keyboard.press("Meta+1");
  await expect(page.getByRole("region", { name: "Commit log" })).toBeVisible();
  await page.keyboard.press("Meta+f");
  await expect(page.getByLabel("Search commits")).toBeFocused();

  await page.keyboard.press("Meta+j");
  await expect(page.getByRole("separator", { name: "Resize bottom panel" })).toHaveCount(0);
  await page.keyboard.press("Meta+j");
  await expect(page.getByRole("separator", { name: "Resize bottom panel" })).toBeVisible();

  await page.keyboard.press("Meta+Shift+t");
  await expect(page.getByText("Native Terminal", { exact: true })).toBeVisible();
  await page.keyboard.press("Meta+,");
  await expect(page.getByText("Config & Ignore", { exact: true })).toBeVisible();
});

test("dismisses context, popover, and multi-selection one layer at a time", async ({ page }) => {
  const head = page.getByRole("row", {
    name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
  });
  await head.click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(head).toBeFocused();

  const filters = page.getByRole("button", { name: "Filters", exact: true });
  await filters.click();
  await expect(page.getByRole("combobox", { name: "Author" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "Author" })).not.toBeVisible();
  await expect(filters).toBeFocused();

  await page
    .getByRole("row", { name: /Suh Junmin.*fix\(graph\)/ })
    .first()
    .click({ modifiers: ["Meta"] });
  await expect(page.getByRole("complementary", { name: "Revision comparison" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Revision comparison" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Revision review" })).toBeVisible();
});

test("opens a read-only file viewer from local changes", async ({ page }) => {
  await page.getByRole("button", { name: /Changes 5/ }).click();
  await page
    .getByRole("button", {
      name: /M git-service\.ts electron\/utility\/git \+22 −9/,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "View", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Working Tree");
  await expect(dialog.locator(".cm-editor")).toBeVisible();
  await expect(dialog.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
});

test("has no serious automated accessibility violations", async ({ page }) => {
  await expect(page.locator(".cm-content").first()).toBeVisible();
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});
