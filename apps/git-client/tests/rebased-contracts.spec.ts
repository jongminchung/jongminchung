import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

interface RebasedContracts {
    readonly projectSwitcher: {
        readonly dialog: string;
        readonly actions: readonly string[];
        readonly sections: readonly string[];
        readonly initialFocus: string;
    };
    readonly branchPopup: {
        readonly dialog: string;
        readonly search: string;
        readonly actions: readonly string[];
        readonly groups: readonly string[];
        readonly settings: string;
    };
}

const contracts = JSON.parse(
    readFileSync(
        new URL("./contracts/rebased-1.1.8.json", import.meta.url),
        "utf8",
    ),
) as RebasedContracts;

test.beforeEach(async ({ page }) => {
    await page.goto("/?fixture=qa");
});

test("matches the Rebased project switcher interaction contract", async ({
    page,
}) => {
    const projectButton = page.getByRole("button", {
        name: "Project: git-client",
    });
    await projectButton.click();
    const popup = page.getByRole("dialog", {
        name: contracts.projectSwitcher.dialog,
    });

    for (const action of contracts.projectSwitcher.actions) {
        await expect(popup.getByRole("button", { name: action })).toBeVisible();
    }
    for (const section of contracts.projectSwitcher.sections) {
        await expect(popup.getByText(section, { exact: true })).toBeVisible();
    }
    await expect(
        popup.getByRole("button", {
            name: contracts.projectSwitcher.initialFocus,
        }),
    ).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(
        popup.getByRole("button", {
            name: contracts.projectSwitcher.actions[1],
        }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(projectButton).toBeFocused();
});

test("matches the Rebased branch popup structure contract", async ({
    page,
}) => {
    await page
        .getByRole("banner", { name: "Main Toolbar" })
        .getByRole("button", { name: "main" })
        .click();
    const popup = page.getByRole("dialog", {
        name: contracts.branchPopup.dialog,
    });

    await expect(
        popup.getByRole("combobox", { name: contracts.branchPopup.search }),
    ).toBeFocused();
    for (const action of contracts.branchPopup.actions) {
        await expect(popup.getByRole("button", { name: action })).toBeVisible();
    }
    for (const group of contracts.branchPopup.groups) {
        await expect(popup.getByRole("region", { name: group })).toBeVisible();
    }
    await expect(
        popup.getByRole("button", { name: contracts.branchPopup.settings }),
    ).toBeVisible();
});
