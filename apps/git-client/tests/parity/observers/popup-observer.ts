import type { Locator } from "@playwright/test";

async function accessibleName(locator: Locator): Promise<string> {
  const label = await locator.getAttribute("aria-label");
  if (label) return label;
  const labelledBy = await locator.getAttribute("aria-labelledby");
  if (labelledBy) return locator.page().locator(`#${labelledBy}`).innerText();
  return (await locator.innerText()).trim();
}

function normalizedText(values: readonly string[]): readonly string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export async function observeProjectSwitcher(
  popup: Locator,
): Promise<Readonly<Record<string, unknown>>> {
  const options = popup.getByRole("option");
  return Object.freeze({
    structure: {
      list: await accessibleName(popup),
      actions: normalizedText(await options.allTextContents()).slice(0, 2),
      sections: normalizedText(await popup.locator("[data-project-section]").allTextContents()),
    },
    accessibility: {
      containerRole: await popup.getAttribute("role"),
      itemRole: await options.first().getAttribute("role"),
      initialSelected: await accessibleName(
        popup.locator('[role="option"][aria-selected="true"]').first(),
      ),
    },
  });
}

export async function observeBranchPopup(
  popup: Locator,
): Promise<Readonly<Record<string, unknown>>> {
  const search = popup.getByRole("textbox", { name: "Search" });
  const tree = popup.getByRole("tree", { name: "Branches Tree" });
  return Object.freeze({
    structure: {
      tree: await accessibleName(tree),
      search: await accessibleName(search),
      searchHelp: await search.getAttribute("placeholder"),
      actions: await tree
        .locator('[data-branch-action="true"] > span')
        .evaluateAll((items) => items.map((item) => item.textContent?.trim() ?? "")),
      groups: await tree
        .locator('[data-branch-group="true"] > span')
        .evaluateAll((items) => items.map((item) => item.textContent?.trim() ?? "")),
      toolbar: await popup
        .locator('[data-branch-toolbar="true"] button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? "")),
    },
    accessibility: {
      treeRole: await tree.getAttribute("role"),
      itemRole: await tree.getByRole("treeitem").first().getAttribute("role"),
      searchRole: await search.getAttribute("role"),
    },
  });
}
