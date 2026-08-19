import { expect, test } from "@playwright/test";
import type { DesktopApi } from "../src/shared/contracts/desktop-api";
import {
    launchPackaged,
    resetQaProfile,
    runtimeProfileName,
} from "./packaged-app-harness";

test("[성공]고정된 Rebased Workbench 헬멧과 위험을 감수함", async () => {
    await resetQaProfile("Git Client Electron QA Fixture");
    const app = await launchPackaged(["--qa-fixture"]);
    try {
        const { page } = app;
        const mainToolbar = page.getByRole("banner", {
            name: "Main Toolbar",
        });
        const project = mainToolbar.getByRole("button", {
            name: "Project: git-client",
            exact: true,
        });
        const branch = mainToolbar.getByRole("button", {
            name: "main",
            exact: true,
        });
        const log = page.getByRole("tab", {
            name: "Log",
            exact: true,
        });
        const changes = page.getByRole("button", {
            name: "Commit",
            exact: true,
        });
        await expect(project).toHaveText("Ggit-client");
        await expect(branch).toContainText("main");
        await expect(log).toBeVisible();
        await expect(changes).toBeVisible();
        await expect(
            mainToolbar.getByRole("button", { name: "Update Project..." }),
        ).toBeVisible();
        await expect(
            mainToolbar.getByRole("button", { name: "Push…", exact: true }),
        ).toBeVisible();
        await expect(
            mainToolbar.getByRole("button", { name: "Search Everywhere" }),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );
        await expect(
            page.getByRole("navigation", { name: "Left Toolbar" }),
        ).toBeVisible();
        const toolWindows = page.getByRole("navigation", {
            name: "Left Toolbar",
        });
        await expect(
            toolWindows.getByRole("button", {
                name: "Terminal",
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            toolWindows.getByRole("button", { name: "Git", exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole("navigation", { name: "Workspace tabs" }),
        ).toHaveCount(0);
        await expect(
            page.getByRole("navigation", { name: "Repository views" }),
        ).toHaveCount(0);
        await expect(
            page.getByRole("tablist", { name: "Bottom tool windows" }),
        ).toHaveCount(0);
        await expect(page.locator("[data-oid]").first()).toBeVisible();
        await expect(
            page.getByText("Select commit to view changes", { exact: true }),
        ).toBeVisible();
        for (const tab of [project, branch, log, changes]) {
            const labelMetrics = await tab.evaluate((element) => {
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
            expect(labelMetrics.clientWidth).toBeGreaterThan(0);
            expect(labelMetrics.clientHeight).toBeGreaterThan(0);
            expect(labelMetrics.scrollWidth).toBeLessThanOrEqual(
                labelMetrics.clientWidth + 1,
            );
            expect(labelMetrics.scrollHeight).toBeLessThanOrEqual(
                labelMetrics.clientHeight + 1,
            );
            expect(labelMetrics.fontSize).toBeGreaterThanOrEqual(12);
            expect(labelMetrics.lineHeight).toBeGreaterThanOrEqual(
                labelMetrics.fontSize,
            );
            expect(labelMetrics.opacity).toBe(1);
            expect(labelMetrics.color).not.toBe("rgba(0, 0, 0, 0)");
        }

        const metrics = await log.evaluate((element) => {
            const style = getComputedStyle(element);
            const bounds = element.getBoundingClientRect();
            return {
                display: style.display,
                height: bounds.height,
                paddingLeft: Number.parseFloat(style.paddingLeft),
                paddingRight: Number.parseFloat(style.paddingRight),
            };
        });
        expect(metrics).toMatchObject({ display: "flex" });
        expect(metrics.height).toBe(32);
        expect(
            await log.evaluate((element) => getComputedStyle(element).fontSize),
        ).toBe("12px");
        expect(metrics.paddingLeft).toBeGreaterThanOrEqual(7);
        expect(metrics.paddingRight).toBeGreaterThanOrEqual(7);

        const [toolbarBounds, projectBounds, branchBounds, logBounds] =
            await Promise.all([
                mainToolbar.boundingBox(),
                project.boundingBox(),
                branch.boundingBox(),
                log.boundingBox(),
            ]);
        expect(toolbarBounds?.height).toBe(35);
        expect(projectBounds).not.toBeNull();
        expect(branchBounds?.x ?? 0).toBeGreaterThanOrEqual(
            (projectBounds?.x ?? 0) + (projectBounds?.width ?? 0),
        );
        expect(logBounds?.height).toBe(32);

        const toolbarOrder = await mainToolbar
            .getByRole("button")
            .evaluateAll((buttons) =>
                buttons
                    .map((button) => button.getAttribute("aria-label"))
                    .filter(Boolean),
            );
        expect(toolbarOrder).toEqual(
            expect.arrayContaining([
                "Project: git-client",
                "Update Project...",
                "Push…",
                "main",
                "Search Everywhere",
                "IDE and Project Settings",
            ]),
        );
        const orderedLabels = [
            "Project: git-client",
            "Update Project...",
            "Push…",
            "main",
            "Search Everywhere",
            "IDE and Project Settings",
        ];
        const toolbarIndices = orderedLabels.map((label) =>
            toolbarOrder.indexOf(label),
        );
        expect(toolbarIndices.every((index) => index >= 0)).toBe(true);
        expect(toolbarIndices).toEqual(
            [...toolbarIndices].sort((left, right) => left - right),
        );

        const [projectToolBounds, revisionReviewBounds] = await Promise.all([
            page
                .getByRole("region", { name: "Project Tool Window" })
                .boundingBox(),
            page
                .getByRole("complementary", { name: "Revision review" })
                .boundingBox(),
        ]);
        expect(projectToolBounds?.width).toBe(458);
        expect(revisionReviewBounds?.width).toBe(253);

        for (const label of ["Branch", "User", "Date"]) {
            const control = page.getByRole("combobox", { name: label });
            await expect(control).toBeVisible();
            expect((await control.boundingBox())?.height).toBeLessThanOrEqual(
                35,
            );
            expect(await control.textContent()).toContain(label);
        }
        const paths = page.getByRole("textbox", { name: "Paths" });
        expect((await paths.boundingBox())?.height).toBeLessThanOrEqual(35);
        await expect(page.getByText(/↑ push|↓ pull/u)).toHaveCount(0);

        await changes.click();
        const changedFiles = page.getByRole("complementary", {
            name: "Changed files",
        });
        const commitLog = page.getByRole("region", { name: "Commit log" });
        const revisionReview = page.getByRole("complementary", {
            name: "Revision review",
        });
        await expect(changedFiles).toBeVisible();
        await expect(commitLog).toBeVisible();
        await expect(revisionReview).toBeVisible();
        expect((await changedFiles.boundingBox())?.width).toBe(302);
        expect((await revisionReview.boundingBox())?.width).toBe(253);

        await page.evaluate(() => window.resizeTo(1584, 918));
        await expect
            .poll(() => page.evaluate(() => window.outerWidth))
            .toBe(1584);
        expect((await changedFiles.boundingBox())?.width).toBe(302);
        expect((await revisionReview.boundingBox())?.width).toBe(253);
        expect((await commitLog.boundingBox())?.width ?? 0).toBeGreaterThan(
            700,
        );
    } finally {
        await app.close();
    }
});

test("[성공] 패키지화된 Electron Welcome Geometry를 사용함", async () => {
    await resetQaProfile(runtimeProfileName);
    const app = await launchPackaged(["--qa-isolated-profile"]);
    try {
        const response = await app.page.reload();
        const headers = await response?.allHeaders();
        expect(headers?.["content-security-policy"]).toContain(
            "default-src 'self'",
        );
        expect(headers?.["content-security-policy"]).toContain(
            "object-src 'none'",
        );
        await expect
            .poll(() => app.page.evaluate(() => window.location.origin))
            .toBe("app://git-client");
        await expect
            .poll(() =>
                app.page.evaluate(async () => {
                    const api = (
                        window as typeof window & {
                            readonly gitClient?: DesktopApi;
                        }
                    ).gitClient;
                    return api?.runtime.getInfo();
                }),
            )
            .toMatchObject({ qaFixture: false });
        await expect(app.page).toHaveTitle("Welcome to Git Client");
        await expect(app.page.getByTestId("welcome-titlebar")).toHaveCSS(
            "height",
            "30px",
        );
        await expect(app.page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );
        for (const name of [
            "New Project",
            "Open",
            "Clone Repository",
            "More Actions",
        ]) {
            const action = app.page.getByRole("button", { name });
            const overflow = await action.evaluate((element) => ({
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
            }));
            expect(overflow.scrollHeight).toBeLessThanOrEqual(
                overflow.clientHeight,
            );
        }
        await expect(
            app.page.locator('[data-window-mode="welcome"]'),
        ).toBeVisible();
        const bounds = await app.page.evaluate(() => ({
            height: window.outerHeight,
            width: window.outerWidth,
        }));
        expect(bounds).toEqual({ height: 650, width: 800 });
    } finally {
        await app.close();
    }
});
