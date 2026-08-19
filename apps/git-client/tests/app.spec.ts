import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=qa");
});

test("[성공] 개발 전용 component 상태 fixture를 탐색함", async ({ page }) => {
    await page.goto("/?fixture=components");
    await expect(
        page.getByRole("heading", { name: "Component state fixture" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
    await expect(page.getByRole("alert")).toHaveText(
        "Use an owner/repository value",
    );
    await expect(
        page.getByRole("checkbox", { name: "Selected", exact: true }),
    ).toBeChecked();
    await expect(
        page.getByRole("checkbox", { name: "Disabled" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(
        page.getByRole("dialog").getByText("Fixture dialog", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close fixture dialog" }).click();
    await expect(
        page.getByRole("button", { name: "Open dialog" }),
    ).toBeFocused();
});

test("[성공] 최근 프로젝트를 검색하고 800×650 welcome snapshot을 유지함", async ({
    page,
}) => {
    await page.setViewportSize({ width: 800, height: 650 });
    await page.goto("/?fixture=welcome-recent");
    await expect(page).toHaveTitle("Welcome to Git Client");
    await expect(
        page.getByRole("textbox", { name: "Search projects" }),
    ).toBeVisible();
    await expect(
        page.getByRole("option", { name: /gcloud-cloudlog/ }),
    ).toContainText("feat/opensearch");
    await expect(
        page.getByRole("button", { name: "New Project" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page).toHaveScreenshot(
        "welcome-projects-light-recent-800x650.png",
    );

    const search = page.getByRole("textbox", { name: "Search projects" });
    await search.fill("opensearch");
    await expect(
        page.getByRole("option", { name: /gcloud-cloudlog/ }),
    ).toBeVisible();
    await search.fill("missing-project");
    await expect(page.getByRole("option")).toHaveCount(0);

    await page.goto("/");
    await expect(page.getByText("gcloud-cloudlog")).toHaveCount(0);
});

test("[성공] 빈 프로젝트 welcome 화면을 800×650 viewport에 유지함", async ({
    page,
}) => {
    await page.setViewportSize({ width: 800, height: 650 });
    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Welcome to Git Client" }),
    ).toBeVisible();
    const moreActions = page.getByRole("button", { name: "More Actions" });
    await expect(moreActions).toBeVisible();
    const moreActionsBounds = await moreActions.boundingBox();
    expect(
        (moreActionsBounds?.y ?? 650) + (moreActionsBounds?.height ?? 0),
    ).toBeLessThan(650);
    await expect(page).toHaveScreenshot(
        "welcome-projects-light-empty-800x650.png",
    );
});

test("[성공] Customize를 키보드로 탐색하고 접근 가능한 snapshot을 유지함", async ({
    page,
}) => {
    await page.setViewportSize({ width: 800, height: 650 });
    await page.goto("/");
    await page.getByRole("treeitem", { name: "Projects" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(
        page.getByRole("treeitem", { name: "Customize" }),
    ).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(
        page.getByRole("heading", { name: "Appearance" }),
    ).toBeVisible();
    await expect(page.getByLabel("Theme:")).toContainText("Islands Dark");
    await expect(page.getByText("Plugins", { exact: true })).toHaveCount(0);
    await expect(
        page.getByText("Editor color scheme", { exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByText("Language and Region", { exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Theme:").focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByLabel("Theme:")).toBeFocused();
    await expect(page).toHaveScreenshot(
        "welcome-customize-light-focused-800x650.png",
    );

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
});

test("[성공] appearance 선택과 OS 동기화 설정을 저장하고 복원함", async ({
    page,
}) => {
    await page.goto("/");
    await page.getByRole("treeitem", { name: "Customize" }).click();
    const root = page.locator("html");
    const theme = page.getByLabel("Theme:");
    const syncWithOs = page.getByRole("checkbox", { name: "Sync with OS" });

    await theme.click();
    await page.getByRole("option", { name: "Islands Dark" }).click();
    await expect(root).toHaveAttribute("data-theme", "dark");
    await expect(root).toHaveAttribute("data-appearance-mode", "dark");
    await expect(root).toHaveCSS("color-scheme", "dark");
    await page.reload();
    await page.getByRole("treeitem", { name: "Customize" }).click();
    await expect(theme).toContainText("Islands Dark");
    await expect(root).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await syncWithOs.check();
    await expect(theme).toContainText("Islands Light");
    await expect(root).toHaveAttribute("data-theme", "light");
    await expect(root).toHaveAttribute("data-appearance-mode", "system");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(theme).toContainText("Islands Dark");
    await expect(root).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(theme).toContainText("Islands Light");
    await expect(root).toHaveAttribute("data-theme", "light");
    await syncWithOs.uncheck();
    await expect(theme).toContainText("Islands Light");
    await expect(root).toHaveAttribute("data-theme", "light");
    await expect(root).toHaveAttribute("data-appearance-mode", "light");
    await expect(root).toHaveCSS("color-scheme", "light");
    await expect
        .poll(() =>
            page.evaluate(() =>
                window.localStorage.getItem("git-client.appearance-mode"),
            ),
        )
        .toBe('{"theme":"light","syncWithOs":false}');

    await page.reload();
    await page.getByRole("treeitem", { name: "Customize" }).click();
    await expect(theme).toContainText("Islands Light");
    await expect(syncWithOs).not.toBeChecked();
    await expect(root).toHaveAttribute("data-theme", "light");
});

test("[성공] 3-pane commit log와 revision details snapshot을 유지함", async ({
    page,
}) => {
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
    await expect(page.getByText("Select commit to view changes")).toBeVisible();
    await page
        .getByRole("row", {
            name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
        })
        .click();
    await expect(
        page.getByRole("navigation", { name: "Changed files" }),
    ).toBeVisible();
    await expect(
        page.getByText("Commit details", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTitle("Local-only commit to push")).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Check for updates" }),
    ).toHaveCount(0);
    await expect(page).toHaveScreenshot("git-log-workbench.png", {
        fullPage: true,
    });
});

test("[성공] dark theme의 workbench snapshot을 유지함", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page).toHaveScreenshot("git-log-workbench-dark.png", {
        fullPage: true,
    });
});

test("[성공] Settings에서 light·dark·OS 동기화 theme를 전환함", async ({
    page,
}) => {
    const settings = page.getByRole("button", {
        name: "IDE and Project Settings",
    });

    await settings.click();
    let dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog
        .getByRole("radio", { name: "Islands Dark", exact: true })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await settings.click();
    dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog
        .getByRole("radio", { name: "Islands Light", exact: true })
        .click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await dialog
        .getByRole("radio", { name: "Sync with OS", exact: true })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("[성공] icon button tooltip을 pointer와 keyboard focus에 표시함", async ({
    page,
}) => {
    const settings = page.getByRole("button", {
        name: "IDE and Project Settings",
    });

    await settings.hover();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(
        "IDE and Project Settings",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);

    await page.mouse.move(0, 0);
    await settings.focus();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(
        "IDE and Project Settings",
    );
});

test("[성공] Settings dialog를 키보드로 조작하고 trigger focus를 복원함", async ({
    page,
}) => {
    const settings = page.getByRole("button", {
        name: "IDE and Project Settings",
    });
    await settings.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    const light = dialog.getByRole("radio", {
        name: "Islands Light",
        exact: true,
    });
    await light.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(settings).toBeFocused();
});

test("[성공] reduced motion·forced colors·150% zoom에서 Settings 접근성을 유지함", async ({
    page,
}) => {
    await page.setViewportSize({ width: 960, height: 640 });
    await page.emulateMedia({
        forcedColors: "active",
        reducedMotion: "reduce",
    });
    await page
        .getByRole("button", { name: "IDE and Project Settings" })
        .click();

    const dialog = page.getByRole("dialog", { name: "Settings" });
    const zoom = dialog.getByRole("radio", { name: "150%", exact: true });
    await zoom.focus();
    await page.keyboard.press("Space");

    await expect(zoom).toBeChecked();
    await expect(zoom).toBeFocused();
    await expect
        .poll(() =>
            page.evaluate(() =>
                getComputedStyle(document.documentElement)
                    .getPropertyValue("--product-zoom")
                    .trim(),
            ),
        )
        .toBe("1.5");
    await expect
        .poll(() =>
            dialog.evaluate((element) => {
                return getComputedStyle(element)
                    .animationDuration.split(",")
                    .every((duration) => {
                        const value = Number.parseFloat(duration);
                        return duration.trim().endsWith("ms")
                            ? value <= 0.01
                            : value <= 0.000_01;
                    });
            }),
        )
        .toBe(true);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    matchMedia("(forced-colors: active)").matches &&
                    matchMedia("(prefers-reduced-motion: reduce)").matches,
            ),
        )
        .toBe(true);

    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(960);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
});

test("[성공] Select를 키보드로 조작하고 dialog 위 layer와 focus를 유지함", async ({
    page,
}) => {
    await page
        .getByRole("button", { name: "IDE and Project Settings" })
        .click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    const ideFont = dialog.getByLabel("IDE font");
    const initialValue = await ideFont.textContent();

    await ideFont.focus();
    await page.keyboard.press("Space");
    await expect(
        page.getByRole("option", { name: "72.0", exact: true }),
    ).toBeVisible();
    const selectLayer = await page
        .getByRole("listbox")
        .evaluate((listbox) =>
            Number(
                getComputedStyle(listbox.parentElement!.parentElement!).zIndex,
            ),
        );
    const dialogLayer = await dialog.evaluate((element) =>
        Number(getComputedStyle(element).zIndex),
    );
    const expectedLayers = await page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        return {
            dialog: Number(rootStyle.getPropertyValue("--layer-dialog")),
            select: Number(rootStyle.getPropertyValue("--layer-select")),
        };
    });
    expect(dialogLayer).toBe(expectedLayers.dialog);
    expect(selectLayer).toBe(expectedLayers.select);
    expect(selectLayer).toBeGreaterThan(dialogLayer);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect.poll(() => ideFont.textContent()).not.toBe(initialValue);
    await expect(ideFont).toBeFocused();

    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(ideFont).toBeFocused();
});

test("[성공] 최소 viewport에서 핵심 workbench와 keyboard focus를 유지함", async ({
    page,
}) => {
    await page.setViewportSize({ width: 960, height: 640 });
    await expect(
        page.getByRole("complementary", { name: "Branches and tags" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Branches" })).toBeVisible();
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

test("[성공] reword dialog에서 빈 commit message를 검증함", async ({
    page,
}) => {
    const head = page.getByRole("row", {
        name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
    });
    await head.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Reword Commit…" }).click();
    const dialog = page.getByRole("dialog", { name: "Reword commit" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("New commit message").fill("");
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog.getByLabel("New commit message")).toHaveAttribute(
        "required",
        "",
    );
    await expect(dialog).toBeVisible();
});

test("[성공] commit context menu의 action availability를 표시함", async ({
    page,
}) => {
    const head = page.getByRole("row", {
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

test("[성공] commit 선택 시 첫 변경 파일과 details를 함께 표시함", async ({
    page,
}) => {
    await page
        .getByRole("row", {
            name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
        })
        .click();
    await expect(
        page
            .getByRole("navigation", { name: "Changed files" })
            .getByRole("button")
            .first(),
    ).toHaveAttribute("aria-current", "true");
    await expect(
        page.getByText("Commit details", { exact: true }),
    ).toBeVisible();
});

test("[성공] 두 commit을 선택해 revision comparison과 diff를 표시함", async ({
    page,
}) => {
    await page
        .getByRole("row", {
            name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
        })
        .click();
    await page
        .getByRole("row", { name: /Suh Junmin.*fix\(graph\)/ })
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

test("[성공] changes workspace에서 선택·focused diff·file action을 연결함", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Commit", exact: true }).click();
    const changedFiles = page.getByRole("complementary", {
        name: "Changed files",
    });
    await expect(
        changedFiles.getByRole("button", {
            name: /M actionAvailability\.ts src\/domain \+34 −4/,
            exact: true,
        }),
    ).toHaveAttribute("aria-current", "true");
    await changedFiles.focus();
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("region", {
            name: "Diff for src/domain/actionAvailability.ts",
        }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page
        .getByRole("button", {
            name: /M git-service\.ts electron\/utility\/git \+22 −9/,
            exact: true,
        })
        .click();
    await expect(
        changedFiles.getByRole("button", {
            name: /M git-service\.ts electron\/utility\/git \+22 −9/,
            exact: true,
        }),
    ).toHaveAttribute("aria-current", "true");
    await changedFiles.focus();
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("region", {
            name: "Diff for electron/utility/git/git-service.ts",
        }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Stage file" }),
    ).toBeVisible();
});

test("[성공] diverged branch의 force-with-lease 확인과 Push 단축키를 검증함", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Push…", exact: true }).click();
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

    await page.getByRole("button", { name: "Push…", exact: true }).click();
    const reopened = page.getByRole("dialog", { name: "Push" });
    await expect(
        reopened.getByRole("radio", { name: /Normal push/ }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(reopened).toHaveCount(0);
    await page.keyboard.press("Meta+Shift+p");
    await expect(page.getByRole("dialog", { name: "Push" })).toBeVisible();
});

test("[성공] published commit을 확인하고 interactive rebase를 완료함", async ({
    page,
}) => {
    const commit = page.getByRole("row", {
        name: /Jamie 2 hours ago refactor: isolate credential redaction/,
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
    const action = dialog.getByLabel(/Action for/).first();
    await action.click();
    await page.getByRole("option", { name: "reword", exact: true }).click();
    await expect(dialog.getByLabel(/New message for/).first()).toBeVisible();
    await dialog.getByRole("button", { name: "Start Rebase" }).click();
    const confirmation = page.getByRole("dialog", {
        name: "Rewrite protected branch main?",
    });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Start rebase" }).click();
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

test("[성공] repository clone form을 전환하고 필수 입력을 검증함", async ({
    page,
}) => {
    await page.getByRole("button", { name: /Project:/ }).click();
    await page.getByRole("option", { name: "Clone Repository…" }).click();
    const dialog = page.getByRole("dialog", { name: "Repository" });
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole("button", { name: "Clone", exact: true }).first(),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("Remote URL")).toBeVisible();
    await dialog
        .getByRole("contentinfo")
        .getByRole("button", { name: "Clone", exact: true })
        .click();
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
    await dialog
        .getByRole("contentinfo")
        .getByRole("button", { name: "Clone", exact: true })
        .click();
    await expect(dialog.getByRole("alert")).toContainText(
        "Real repository actions are disabled while the QA fixture is active.",
    );
    await dialog.getByRole("button", { name: "Initialize" }).click();
    await expect(dialog.getByText("Bare repository")).toBeVisible();
});

test("[성공] QA fixture에서 shell 없이 terminal empty state를 표시함", async ({
    page,
}) => {
    await expect(
        page.getByRole("dialog", { name: "Repository Management" }),
    ).toHaveCount(0);
    const terminalTab = page.getByRole("button", {
        name: "Terminal",
        exact: true,
    });
    await terminalTab.click();

    const emptyTerminal = page
        .locator('[data-slot="empty"]')
        .filter({ hasText: "Native Terminal" });
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

test("[성공] 별도 Manage surface 없이 기본 workbench를 표시함", async ({
    page,
}) => {
    await expect(
        page.getByRole("button", { name: "Manage", exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await expect(
        page.getByRole("banner", { name: "Main Toolbar" }),
    ).toBeVisible();
});

test("[성공] project switcher를 닫은 뒤 trigger focus를 복원함", async ({
    page,
}) => {
    const projectButton = page.getByRole("button", {
        name: "Project: git-client",
    });
    await projectButton.click();

    const popup = page.getByRole("dialog", { name: "Projects" });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole("option", { name: "Open…" })).toBeVisible();
    await expect(popup.getByRole("option", { name: "Open…" })).toBeFocused();
    await expect(
        popup.getByRole("option", { name: "Clone Repository…" }),
    ).toBeVisible();
    await expect(
        popup.getByText("Open Projects", { exact: true }),
    ).toBeVisible();
    await expect(popup.getByText("git-client", { exact: true })).toBeVisible();
    await expect(
        page.getByRole("dialog", { name: "Repository Management" }),
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(projectButton).toBeFocused();
});

test("[성공] graph filter와 commit options popover를 표시함", async ({
    page,
}) => {
    await page
        .getByRole("button", { name: "Graph Options", exact: true })
        .click();
    const authorFilter = page.getByRole("combobox", { name: "Author" });
    await expect(authorFilter).toBeVisible();
    await expect(
        page.getByRole("textbox", { name: "Path", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(authorFilter).not.toBeVisible();

    await page.getByRole("button", { name: "Commit", exact: true }).click();
    await expect(
        page.getByRole("complementary", { name: "Changed files" }),
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

test("[성공] keyboard로 bottom panel separator를 조절함", async ({ page }) => {
    await page.getByRole("button", { name: "Terminal", exact: true }).click();
    const separator = page.getByRole("separator", {
        name: "Resize bottom panel",
    });
    const initialHeight = Number(await separator.getAttribute("aria-valuenow"));
    expect(initialHeight).toBeGreaterThanOrEqual(160);
    await separator.focus();
    await page.keyboard.press("ArrowUp");
    await expect(separator).toHaveAttribute(
        "aria-valuenow",
        String(Math.min(initialHeight + 10, 420)),
    );
    await page.keyboard.press("Home");
    await expect(separator).toHaveAttribute("aria-valuenow", "160");
});

test("[성공] revision review를 조절하고 commit tool window로 전환함", async ({
    page,
}) => {
    await page
        .getByRole("navigation", { name: "Left Toolbar" })
        .getByRole("button", { name: "Project", exact: true })
        .click();
    const review = page.getByRole("separator", {
        name: "Resize revision review",
    });
    await expect(review).toHaveAttribute("aria-valuenow", "253");
    await review.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(review).toHaveAttribute("aria-valuenow", "265");

    await page.getByRole("button", { name: "Commit", exact: true }).click();
    await expect(
        page.getByRole("complementary", { name: "Changed files" }),
    ).toBeVisible();
    await expect(
        page.getByRole("separator", {
            name: "Resize change navigator",
        }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await expect(
        page.getByRole("complementary", { name: "Revision review" }),
    ).toBeVisible();
});

test("[성공] branch picker에서 Branches & Tags dialog를 열고 닫음", async ({
    page,
}) => {
    await page
        .getByRole("banner", { name: "Main Toolbar" })
        .getByRole("button", { name: "main" })
        .click();
    const branchesPopup = page.getByRole("dialog", { name: "Git Branches" });
    await expect(branchesPopup).toBeVisible();
    await branchesPopup.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Branches & Tags" });
    await expect(dialog).toBeVisible();
    await expect(
        page.getByRole("dialog", { name: "Repository Management" }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close Branches & Tags" }).click();
    await expect(dialog).toHaveCount(0);
});

test("[성공] workbench shortcut으로 search·palette·panel·settings를 조작함", async ({
    page,
}) => {
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await page.keyboard.press("Meta+0");
    await expect(
        page
            .getByRole("complementary", { name: "Changed files" })
            .getByRole("button", {
                name: /M actionAvailability\.ts src\/domain \+34 −4/,
                exact: true,
            }),
    ).toHaveAttribute("aria-current", "true");

    await page.keyboard.press("Meta+f");
    await expect(page.getByLabel("Filter changed files")).toBeFocused();
    await page.keyboard.press("Meta+Enter");
    await expect(page.locator("[data-command-status]")).toContainText(
        "Enter a commit message and stage at least one file.",
    );
    await page.keyboard.press("Meta+p");
    const palette = page.getByRole("dialog", { name: "Search Everywhere" });
    await expect(palette).toBeVisible();
    const paletteAccessibility = await new AxeBuilder({ page })
        .include('[role="dialog"][aria-label="Search Everywhere"]')
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
    await page.keyboard.press("ArrowDown");
    await expect(palette.getByRole("combobox")).toHaveAttribute(
        "aria-activedescendant",
        /.+/u,
    );
    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
    await expect(page.getByLabel("Filter changed files")).toBeFocused();

    await page.keyboard.press("Meta+p");
    const executablePalette = page.getByRole("dialog", {
        name: "Search Everywhere",
    });
    await executablePalette.getByRole("combobox").fill("Settings");
    await expect(
        executablePalette.getByRole("option", { name: /Settings/u }).first(),
    ).toBeVisible();
    await page.keyboard.press("Enter");
    const paletteSettings = page.getByRole("dialog", { name: "Settings" });
    await expect(paletteSettings).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(paletteSettings).toHaveCount(0);

    await page.keyboard.press("Meta+1");
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await page.keyboard.press("Meta+f");
    await expect(
        page.getByRole("textbox", { name: "Search", exact: true }),
    ).toBeFocused();

    await page.keyboard.press("Meta+j");
    await expect(
        page.getByRole("separator", { name: "Resize bottom panel" }),
    ).toBeVisible();
    await page.keyboard.press("Meta+j");
    await expect(
        page.getByRole("separator", { name: "Resize bottom panel" }),
    ).toHaveCount(0);

    await page.keyboard.press("Meta+,");
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);

    await page.keyboard.press("Alt+F12");
    await expect(
        page.getByText("Native Terminal", { exact: true }),
    ).toBeVisible();
});

test("[성공] menu·popover·revision comparison을 Escape로 순서대로 닫음", async ({
    page,
}) => {
    const head = page.getByRole("row", {
        name: /Jongmin Chung now.*feat: add workspace-aware repository sessions 0000000/,
    });
    await head.click({ button: "right" });
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(head).toBeFocused();

    const filters = page.getByRole("button", {
        name: "Graph Options",
        exact: true,
    });
    await filters.click();
    await expect(page.getByRole("combobox", { name: "Author" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("combobox", { name: "Author" }),
    ).not.toBeVisible();
    await expect(filters).toBeFocused();

    await page
        .getByRole("row", { name: /Suh Junmin.*fix\(graph\)/ })
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

test("[성공] changed file을 editable CodeMirror editor로 표시함", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Commit", exact: true }).click();
    await page
        .getByRole("button", {
            name: /M git-service\.ts electron\/utility\/git \+22 −9/,
            exact: true,
        })
        .click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    const viewer = page.getByRole("region", {
        name: "Editor: electron/utility/git/git-service.ts",
    });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator(".cm-editor")).toBeVisible();
    await expect(viewer.locator(".cm-content")).toHaveAttribute(
        "contenteditable",
        "true",
    );
});

test("[성공] log·editor tab과 panel을 연결하고 keyboard lifecycle을 유지함", async ({
    page,
}) => {
    const expectLinkedPanel = async (
        tab: ReturnType<typeof page.getByRole>,
    ) => {
        const tabId = await tab.getAttribute("id");
        const panelId = await tab.getAttribute("aria-controls");
        expect(tabId).toBeTruthy();
        expect(panelId).toBeTruthy();
        const panel = page.locator(`[id="${panelId}"]`);
        await expect(panel).toHaveAttribute("aria-labelledby", tabId!);
        await expect(panel).toBeVisible();
    };

    await page
        .getByRole("navigation", { name: "Left Toolbar" })
        .getByRole("button", { name: "Project", exact: true })
        .click();
    const firstLogTab = page.getByRole("tab", { name: "Log", exact: true });
    await expect(firstLogTab).toHaveAttribute("aria-selected", "true");
    await expectLinkedPanel(firstLogTab);

    await page.getByRole("button", { name: "Open New Git Log Tab" }).click();
    const secondLogTab = page.getByRole("tab", { name: "Log 2", exact: true });
    await expect(secondLogTab).toHaveAttribute("aria-selected", "true");
    await expectLinkedPanel(secondLogTab);

    await firstLogTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(secondLogTab).toBeFocused();
    await expect(secondLogTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Delete");
    await expect(secondLogTab).toHaveCount(0);
    await expect(firstLogTab).toBeFocused();

    await page.getByRole("button", { name: "Commit", exact: true }).click();
    await page
        .getByRole("button", {
            name: /M git-service\.ts electron\/utility\/git \+22 −9/,
            exact: true,
        })
        .click();
    await page.getByRole("button", { name: "View", exact: true }).click();

    const editorTab = page.getByRole("tab", {
        name: "Editor electron/utility/git/git-service.ts",
        exact: true,
    });
    await expect(editorTab).toHaveAttribute("aria-selected", "true");
    await expectLinkedPanel(editorTab);
    await expect(
        page.getByRole("tablist", { name: "Editor tabs" }).getByRole("button"),
    ).toHaveCount(0);

    await editorTab.focus();
    await page.keyboard.press("Delete");
    await expect(editorTab).toHaveCount(0);
    await expect(firstLogTab).toBeFocused();
});

test("[성공] CodeMirror editor에 serious accessibility violation이 없음", async ({
    page,
}) => {
    await page.getByRole("button", { name: "Commit", exact: true }).click();
    await page
        .getByRole("button", {
            name: /M git-service\.ts electron\/utility\/git \+22 −9/,
            exact: true,
        })
        .click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    const viewer = page.getByRole("region", {
        name: "Editor: electron/utility/git/git-service.ts",
    });
    await expect(viewer.locator(".cm-content")).toBeVisible();
    const results = await new AxeBuilder({ page })
        .include('[aria-label="Editor: electron/utility/git/git-service.ts"]')
        .disableRules(["color-contrast"])
        .analyze();
    expect(
        results.violations.filter((violation) =>
            ["serious", "critical"].includes(violation.impact ?? ""),
        ),
    ).toEqual([]);
});

test("[성공] welcome·workbench·Settings에 serious accessibility violation이 없음", async ({
    page,
}) => {
    const expectNoSeriousViolations = async (
        include?: string,
    ): Promise<void> => {
        let audit = new AxeBuilder({ page }).disableRules(["color-contrast"]);
        if (include) audit = audit.include(include);
        const results = await audit.analyze();
        expect(
            results.violations.filter((violation) =>
                ["serious", "critical"].includes(violation.impact ?? ""),
            ),
        ).toEqual([]);
    };

    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Welcome to Git Client" }),
    ).toBeVisible();
    await expectNoSeriousViolations();

    await page.goto("/?fixture=qa");
    await expect(
        page.getByRole("region", { name: "Commit log" }),
    ).toBeVisible();
    await expectNoSeriousViolations();

    await page
        .getByRole("button", { name: "IDE and Project Settings" })
        .click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await expectNoSeriousViolations('[role="dialog"][aria-label="Settings"]');
});
