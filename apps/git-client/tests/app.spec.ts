import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=qa");
});

test("keeps the normal browser start screen free of repository fixtures", async ({
    page,
}) => {
    await page.goto("/");
    await expect(
        page.getByRole("button", { name: "Manage", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText("Browser preview has no native Git bridge"),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Commit log" })).toHaveCount(
        0,
    );
    await expect(
        page.getByRole("link", { name: "Open QA fixture" }),
    ).toHaveAttribute("href", "/?fixture=qa");
});

test("renders the dense three-pane Git log fixture", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(
        page.getByRole("complementary", { name: "Branches and tags" }),
    ).toBeVisible();
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await expect(
        page.getByRole("complementary", { name: "Revision review" }),
    ).toBeVisible();
    await expect(
        page.getByRole("region", {
            name: "Diff for src/components/CommitLog.tsx",
        }),
    ).toBeVisible();
    await expect(page.getByTitle("Local-only commit to push")).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Check for updates" }),
    ).toHaveCount(0);
    await expect(page).toHaveScreenshot("git-log-workbench.png", {
        fullPage: true,
    });
});

test("renders the Codex neutral dark theme", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: /Appearance:/ }).click();
    await page.getByRole("radio", { name: "Black", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page).toHaveScreenshot("git-log-workbench-dark.png", {
        fullPage: true,
    });
});

test("supports persisted System Appearance, White, and Black modes", async ({
    page,
}) => {
    const appearance = page.getByRole("button", { name: /Appearance:/ });

    await appearance.click();
    await page.getByRole("radio", { name: "Black", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(appearance).toHaveAttribute("aria-label", "Appearance: Black");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(appearance).toHaveAttribute("aria-label", "Appearance: Black");

    await appearance.click();
    await page.getByRole("radio", { name: "White", exact: true }).click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await appearance.click();
    await page
        .getByRole("radio", { name: "System Appearance", exact: true })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("navigates the Appearance menu with the keyboard", async ({ page }) => {
    const appearance = page.getByRole("button", { name: /Appearance:/ });
    await appearance.focus();
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("dialog", { name: "Appearance" }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot("appearance-menu.png", {
        fullPage: true,
    });
    await page.keyboard.press("End");
    await expect(
        page.getByRole("radio", { name: "Black", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(appearance).toHaveAttribute("aria-label", "Appearance: Black");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Appearance" })).toHaveCount(
        0,
    );
    await expect(appearance).toBeFocused();
});

test("keeps core panes usable at the minimum window size", async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 640 });
    await expect(
        page.getByRole("complementary", { name: "Branches and tags" }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await expect(
        page.getByRole("complementary", { name: "Revision review" }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await expect(page).toHaveScreenshot("git-log-workbench-minimum.png", {
        fullPage: true,
    });
});

test("uses an in-app validated dialog for history rewrites", async ({
    page,
}) => {
    const head = page.getByRole("button", {
        name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
    });
    await head.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Reword Commit…" }).click();
    const dialog = page.getByRole("dialog", { name: "Reword commit" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("New commit message").fill("");
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
        "New commit message is required.",
    );
});

test("shares action availability with the commit context menu", async ({
    page,
}) => {
    const head = page.getByRole("button", {
        name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
    });
    await head.click({ button: "right" });
    await expect(
        page.getByRole("menuitem", { name: /Copy Revision Number.*⌥⇧⌘C/ }),
    ).toBeEnabled();
    await expect(
        page.getByRole("menuitem", { name: "Cherry-Pick" }),
    ).toBeDisabled();
    await expect(
        page.getByRole("menuitem", { name: "Push All up to Here…" }),
    ).toBeEnabled();
});

test("auto-selects the first history file and keeps diff review inline", async ({
    page,
}) => {
    await expect(
        page.getByRole("region", {
            name: "Diff for src/components/CommitLog.tsx",
        }),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Diff for/ })).toHaveCount(0);
    await expect(
        page.getByText("1 differences", { exact: true }),
    ).toBeVisible();
    await expect(
        page
            .locator(".cm-changedText, .cm-deletedLine, .cm-insertedLine")
            .first(),
    ).toBeVisible();
    await page.getByLabel("Diff view mode").selectOption("split");
    await expect(page.locator(".cm-mergeView")).toBeVisible();
    const search = page.getByRole("textbox", { name: "Search diff" });
    await search.fill("revision");
    await expect(page.getByText("1/2", { exact: true })).toBeVisible();
    await page.keyboard.press("Meta+g");
    await expect(page.getByText("2/2", { exact: true })).toBeVisible();
    await page.keyboard.press("Meta+Shift+g");
    await expect(page.getByText("1/2", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Focus diff" }).click();
    await expect(
        page.getByRole("button", { name: "Exit focused diff" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("button", { name: "Focus diff" }),
    ).toBeVisible();
});

test("opens a file navigator automatically for exactly two revisions", async ({
    page,
}) => {
    await page
        .getByRole("button", { name: /Suh Junmin.*fix\(graph\)/ })
        .first()
        .click({ modifiers: ["Meta"] });
    await expect(
        page.getByRole("complementary", { name: "Revision comparison" }),
    ).toBeVisible();
    await expect(
        page.getByRole("navigation", { name: "Compared files" }),
    ).toBeVisible();
    await expect(
        page.getByRole("region", {
            name: "Diff for src/domain/actionAvailability.ts",
        }),
    ).toBeVisible();
});

test("opens Changes with the first layer selected and restores selection after staging", async ({
    page,
}) => {
    await page.getByRole("button", { name: /Changes 5/ }).click();
    await expect(
        page.getByRole("region", {
            name: "Diff for src/domain/actionAvailability.ts",
        }),
    ).toBeVisible();
    await page
        .getByRole("button", {
            name: /M git\.rs src-tauri\/src \+22 −9/,
            exact: true,
        })
        .click();
    await expect(
        page.getByRole("region", { name: "Diff for src-tauri/src/git.rs" }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Stage file" }),
    ).toBeVisible();
});

test("opens one reviewed Push dialog and requires exact lease confirmation", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Push 1", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Push" });
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole("radio", { name: /Normal push/ }),
    ).toBeChecked();
    await expect(
        dialog.getByRole("radio", { name: /Force push with lease/ }),
    ).toBeDisabled();

    await dialog.getByLabel("Destination branch").fill("refs/heads/diverged");
    await dialog.getByRole("button", { name: "Review destination" }).click();
    await expect(
        dialog.getByText("Diverged / rewritten", { exact: true }),
    ).toBeVisible();
    await expect(
        dialog.getByRole("radio", { name: /Normal push/ }),
    ).toBeDisabled();
    await dialog.getByRole("radio", { name: /Force push with lease/ }).check();
    await expect(
        dialog.getByRole("button", { name: "Force Push with Lease" }),
    ).toBeDisabled();
    await dialog.getByLabel(/Type diverged to confirm/).fill("diverged");
    await expect(
        dialog.getByRole("button", { name: "Force Push with Lease" }),
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Push 1", exact: true }).click();
    const reopened = page.getByRole("dialog", { name: "Push" });
    await expect(
        reopened.getByRole("radio", { name: /Normal push/ }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(reopened).toHaveCount(0);
    await page.keyboard.press("Meta+Shift+p");
    await expect(page.getByRole("dialog", { name: "Push" })).toBeVisible();
});

test("opens published commits in the visual interactive rebase workspace", async ({
    page,
}) => {
    const commit = page.getByRole("button", {
        name: /Jamie 2h ago refactor: isolate credential redaction/,
    });
    await commit.click({ button: "right" });
    await page
        .getByRole("menuitem", { name: "Interactive Rebase from Here…" })
        .click();
    const dialog = page.getByRole("dialog", { name: "History Rewrite" });
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByText("2 published commit(s)", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("Published", { exact: true })).toHaveCount(2);

    const rows = dialog.locator("tr[data-rebase-oid]");
    await expect(rows).toHaveCount(3);
    const firstOid = await rows.first().getAttribute("data-rebase-oid");
    await rows.first().dragTo(rows.nth(2));
    await expect(rows.first()).not.toHaveAttribute(
        "data-rebase-oid",
        firstOid ?? "",
    );
    await dialog
        .getByLabel(/Action for/)
        .first()
        .selectOption("reword");
    await expect(dialog.getByLabel(/New message for/).first()).toBeVisible();
    await dialog.getByRole("button", { name: "Start Rebase" }).click();
    await expect(
        dialog.getByText("History rewrite completed", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Push…" }).click();
    const push = page.getByRole("dialog", { name: "Push" });
    await expect(push).toBeVisible();
    await expect(
        push.getByRole("radio", { name: /Normal push/ }),
    ).toBeChecked();
});

test("offers open, clone, and initialize repository flows", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Add repository" }).click();
    const dialog = page.getByRole("dialog", { name: "Add repository" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: "Clone" }).click();
    await expect(dialog.getByText("Remote URL")).toBeVisible();
    await dialog.getByRole("button", { name: "Clone", exact: true }).click();
    await expect(
        dialog.getByText("Enter a remote URL.", { exact: true }),
    ).toBeVisible();
    await expect(
        dialog.getByText("Enter a repository directory.", { exact: true }),
    ).toBeVisible();
    await dialog
        .getByLabel("Remote URL")
        .fill("https://example.invalid/repository.git");
    await dialog.getByLabel("Empty destination").fill("/tmp/fixture-clone");
    await dialog.getByRole("button", { name: "Clone", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(
        "Real repository actions are disabled while the QA fixture is active.",
    );
    await dialog.getByRole("radio", { name: "Initialize" }).click();
    await expect(dialog.getByText("Bare repository")).toBeVisible();
});

test("keeps the browser fixture terminal shell-free", async ({ page }) => {
    await expect(
        page.getByRole("button", { name: "Manage", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Recovery", exact: true }),
    ).toBeVisible();
    const terminalTab = page.getByRole("button", {
        name: "Terminal",
        exact: true,
    });
    await terminalTab.click();

    const emptyTerminal = page
        .getByText("Native Terminal", { exact: true })
        .locator("..");
    await expect(emptyTerminal).toContainText(
        "The deterministic QA fixture does not start a shell.",
    );
    await expect(emptyTerminal).toHaveCSS("display", "flex");
    await expect(emptyTerminal).toHaveCSS("flex-direction", "column");
    await expect(emptyTerminal).toHaveCSS("justify-content", "center");
    await expect(emptyTerminal).toHaveCSS("text-align", "center");
    await expect(
        page.getByRole("button", { name: "Local", exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "New terminal", exact: true }),
    ).toHaveCount(0);
});

test("keeps workspace and repository tab labels visually separated", async ({
    page,
}) => {
    const workspaceTabs = page.getByRole("navigation", {
        name: "Workspace tabs",
    });
    const manageTab = workspaceTabs.getByRole("button", {
        name: "Manage",
        exact: true,
    });
    const repositoryTab = workspaceTabs.getByRole("button", {
        name: "git-client",
        exact: true,
    });
    await expect(manageTab).toHaveText("Manage");
    await expect(repositoryTab).toHaveText("git-client");
    await expect(repositoryTab).toHaveCSS("display", "flex");
    await expect(repositoryTab).toHaveCSS("gap", "6px");
    await expect(repositoryTab).toHaveCSS("padding-left", "13px");

    for (const tab of [manageTab, repositoryTab]) {
        const metrics = await tab.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                clientHeight: element.clientHeight,
                clientWidth: element.clientWidth,
                color: style.color,
                fontSize: Number.parseFloat(style.fontSize),
                lineHeight: Number.parseFloat(style.lineHeight),
                opacity: Number.parseFloat(style.opacity),
                scrollHeight: element.scrollHeight,
                scrollWidth: element.scrollWidth,
            };
        });
        expect(metrics.clientWidth).toBeGreaterThan(0);
        expect(metrics.clientHeight).toBeGreaterThan(0);
        expect(metrics.scrollWidth).toBeLessThanOrEqual(
            metrics.clientWidth + 1,
        );
        expect(metrics.scrollHeight).toBeLessThanOrEqual(
            metrics.clientHeight + 1,
        );
        expect(metrics.fontSize).toBeGreaterThanOrEqual(12);
        expect(metrics.lineHeight).toBeGreaterThanOrEqual(metrics.fontSize);
        expect(metrics.opacity).toBe(1);
        expect(metrics.color).not.toBe("rgba(0, 0, 0, 0)");
    }

    const [manageBounds, repositoryBounds] = await Promise.all([
        manageTab.boundingBox(),
        repositoryTab.boundingBox(),
    ]);
    expect(manageBounds).not.toBeNull();
    expect(repositoryBounds).not.toBeNull();
    expect(repositoryBounds?.x ?? 0).toBeGreaterThanOrEqual(
        (manageBounds?.x ?? 0) + (manageBounds?.width ?? 0),
    );

    const repositoryViews = page.getByRole("navigation", {
        name: "Repository views",
    });
    const history = repositoryViews.getByRole("button", {
        name: "History",
        exact: true,
    });
    const changes = repositoryViews.getByRole("button", {
        name: "Changes 5",
        exact: true,
    });
    await expect(history).toHaveCSS("display", "flex");
    await expect(history).toHaveCSS("min-height", "27px");
    await expect(history).toHaveCSS("padding-left", "10px");
    await expect(changes).toHaveCSS("gap", "6px");

    for (const tab of [history, changes]) {
        const metrics = await tab.evaluate((element) => ({
            clientHeight: element.clientHeight,
            clientWidth: element.clientWidth,
            scrollHeight: element.scrollHeight,
            scrollWidth: element.scrollWidth,
        }));
        expect(metrics.scrollWidth).toBeLessThanOrEqual(
            metrics.clientWidth + 1,
        );
        expect(metrics.scrollHeight).toBeLessThanOrEqual(
            metrics.clientHeight + 1,
        );
    }

    const changeCount = changes.locator("em");
    // An inline-flex item is blockified to `flex` inside the flex tab button.
    await expect(changeCount).toHaveCSS("display", "flex");
    await expect(changeCount).toHaveCSS("min-width", "16px");
});

test("keeps repository management toolbar actions visually separated", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Manage", exact: true }).click();

    const toolbar = page.locator(".managementToolbar").filter({
        hasText: "Multi-root Session",
    });
    await expect(toolbar).toHaveCSS("display", "flex");
    await expect(toolbar).toHaveCSS("gap", "5px");
    await expect(toolbar).toHaveCSS("padding-left", "11px");
    await expect(toolbar).toHaveCSS("padding-right", "11px");

    const actions = ["Add repository", "Sync checkout", "Sync new branch"].map(
        (name) => toolbar.getByRole("button", { name, exact: true }),
    );
    for (const action of actions) {
        await expect(action).toHaveCSS("display", "flex");
        await expect(action).toHaveCSS("gap", "5px");
        await expect(action).toHaveCSS("min-height", "27px");
        await expect(action).toHaveCSS("padding-left", "8px");
        await expect(action).toHaveCSS("padding-right", "8px");
    }

    const boxes = await Promise.all(
        actions.map((action) => action.boundingBox()),
    );
    for (let index = 1; index < boxes.length; index += 1) {
        const previous = boxes[index - 1];
        const current = boxes[index];
        expect(previous).not.toBeNull();
        expect(current).not.toBeNull();
        expect(
            current!.x - (previous!.x + previous!.width),
        ).toBeGreaterThanOrEqual(4.9);
    }
});

test("keeps log filters and commit options available in compact popovers", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const authorFilter = page.getByRole("combobox", { name: "Author" });
    await expect(authorFilter).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Path" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(authorFilter).not.toBeVisible();

    await page.getByRole("button", { name: /Changes 5/ }).click();
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
    await expect(
        page.getByRole("checkbox", { name: "Commit tracked" }),
    ).toBeVisible();
});

test("resizes the bottom panel with accessible keyboard controls", async ({
    page,
}) => {
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

test("resizes and exposes v4 review panes with accessible separators", async ({
    page,
}) => {
    const review = page.getByRole("separator", {
        name: "Resize revision review",
    });
    await expect(review).toHaveAttribute("aria-valuenow", "760");
    await review.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(review).toHaveAttribute("aria-valuenow", "772");

    await page.getByRole("button", { name: /Changes 5/ }).click();
    const navigator = page.getByRole("separator", {
        name: "Resize change navigator",
    });
    await navigator.focus();
    await page.keyboard.press("ArrowRight");
    await expect(navigator).toHaveAttribute("aria-valuenow", "262");
});

test("routes toolbar shortcuts and management settings tabs", async ({
    page,
}) => {
    await page.getByTitle("Branch operations").click();
    await expect(
        page.getByText("Branches & Tags", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Config & Ignore/ }).click();
    await page.getByRole("button", { name: "Git Config", exact: true }).click();
    await expect(page.getByLabel("Filter Git config scope")).toBeVisible();
});

test("uses the command registry for palette, views, search, drawer, and settings", async ({
    page,
}) => {
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
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
    await expect(
        palette.getByRole("option", { name: /Commit & Push/ }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(
        palette.getByRole("option", { name: /Commit & Push/ }),
    ).toContainText("Enter a commit message");
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
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await page.keyboard.press("Meta+f");
    await expect(page.getByLabel("Search commits")).toBeFocused();

    await page.keyboard.press("Meta+j");
    await expect(
        page.getByRole("separator", { name: "Resize bottom panel" }),
    ).toHaveCount(0);
    await page.keyboard.press("Meta+j");
    await expect(
        page.getByRole("separator", { name: "Resize bottom panel" }),
    ).toBeVisible();

    await page.keyboard.press("Meta+Shift+t");
    await expect(
        page.getByText("Native Terminal", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Meta+,");
    await expect(
        page.getByText("Config & Ignore", { exact: true }),
    ).toBeVisible();
});

test("dismisses context, popover, and multi-selection one layer at a time", async ({
    page,
}) => {
    const head = page.getByRole("button", {
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
    await expect(
        page.getByRole("combobox", { name: "Author" }),
    ).not.toBeVisible();
    await expect(filters).toBeFocused();

    await page
        .getByRole("button", { name: /Suh Junmin.*fix\(graph\)/ })
        .first()
        .click({ modifiers: ["Meta"] });
    await expect(
        page.getByRole("complementary", { name: "Revision comparison" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("complementary", { name: "Revision comparison" }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("complementary", { name: "Revision review" }),
    ).toBeVisible();
});

test("opens a read-only file viewer from local changes", async ({ page }) => {
    await page.getByRole("button", { name: /Changes 5/ }).click();
    await page
        .getByRole("button", {
            name: /M git\.rs src-tauri\/src \+22 −9/,
            exact: true,
        })
        .click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Working Tree");
    await expect(dialog.locator(".cm-editor")).toBeVisible();
    await expect(dialog.locator(".cm-content")).toHaveAttribute(
        "contenteditable",
        "false",
    );
});

test("has no serious automated accessibility violations", async ({ page }) => {
    await expect(page.locator(".cm-content").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .analyze();
    expect(
        results.violations.filter((violation) =>
            ["serious", "critical"].includes(violation.impact ?? ""),
        ),
    ).toEqual([]);
});
