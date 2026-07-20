import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { parseParityContractIndex } from "../scripts/parity/parity-contract.mjs";
import { computeCandidateBuildHash } from "../scripts/parity/parity-workspace.mjs";
import { observeBranchPopup, observeProjectSwitcher } from "./parity/observers/popup-observer";

const appRoot = resolve(import.meta.dirname, "..");
const contracts = parseParityContractIndex(
  JSON.parse(
    readFileSync(resolve(appRoot, "parity/rebased/1.1.8/contracts/index.json"), "utf8"),
  ) as unknown,
);
const observationRoot = resolve(appRoot, "test-results/parity-observations");
let candidateBuildHash = "";

function scenario(id: string) {
  const contract = contracts.scenarios.find((candidate) => candidate.id === id);
  if (!contract) throw new Error(`Missing parity contract: ${id}`);
  return contract;
}

function expectedDimension(contract: ReturnType<typeof scenario>, dimension: string) {
  const expected = contract.reference.expected[dimension];
  if (!expected || typeof expected !== "object") {
    throw new Error(`Missing ${dimension} expectation for ${contract.id}`);
  }
  return expected as Readonly<Record<string, unknown>>;
}

function writeObservation(scenarioId: string, observed: Readonly<Record<string, unknown>>): void {
  mkdirSync(observationRoot, { recursive: true });
  writeFileSync(
    resolve(observationRoot, `${scenarioId}.json`),
    `${JSON.stringify({ scenarioId, buildHash: candidateBuildHash, observed }, null, 2)}\n`,
  );
}

test.beforeAll(async () => {
  candidateBuildHash = await computeCandidateBuildHash(appRoot);
});

test.beforeEach(async ({ page }) => {
  await page.goto("/?fixture=qa");
});

test("[parity:project-switcher.keyboard] matches the project switcher interaction contract", async ({
  page,
}) => {
  const contract = scenario("project-switcher.keyboard");
  const structure = expectedDimension(contract, "structure");
  const interaction = expectedDimension(contract, "interaction");
  const projectButton = page.getByRole("button", { name: "Project: git-client" });
  await projectButton.click();
  const popup = page.getByRole("listbox", { name: String(structure.list) });
  const observed = await observeProjectSwitcher(popup);

  for (const action of structure.actions as readonly string[]) {
    await expect(popup.getByRole("option", { name: action })).toBeVisible();
  }
  for (const section of structure.sections as readonly string[]) {
    await expect(popup.getByText(section, { exact: true })).toBeVisible();
  }
  await expect(popup.getByRole("option", { name: String(interaction.initialFocus) })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    popup.getByRole("option", { name: String(interaction.arrowDownFocus) }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(projectButton).toBeFocused();

  writeObservation(contract.id, {
    ...observed,
    interaction: {
      initialFocus: interaction.initialFocus,
      arrowDownFocus: interaction.arrowDownFocus,
      escapeRestoresFocus: await projectButton.evaluate(
        (button) => button === document.activeElement,
      ),
    },
  });
});

test("[parity:branch-popup.structure] matches the branch popup structure contract", async ({
  page,
}) => {
  const contract = scenario("branch-popup.structure");
  const structure = expectedDimension(contract, "structure");
  await page
    .getByRole("banner", { name: "Main Toolbar" })
    .getByRole("button", { name: "main" })
    .click();
  const tree = page.getByRole("tree", { name: String(structure.tree) });
  const popup = tree.locator("..");
  const observed = await observeBranchPopup(popup);

  await expect(popup.getByRole("textbox", { name: String(structure.search) })).toBeFocused();
  await expect(popup.getByRole("textbox", { name: String(structure.search) })).toHaveAttribute(
    "placeholder",
    String(structure.searchHelp),
  );
  for (const action of structure.actions as readonly string[]) {
    await expect(tree.getByRole("treeitem", { name: action })).toBeVisible();
  }
  for (const group of structure.groups as readonly string[]) {
    await expect(tree.getByRole("treeitem", { name: group, exact: true })).toBeVisible();
  }
  for (const action of structure.toolbar as readonly string[]) {
    await expect(popup.getByRole("button", { name: action })).toBeVisible();
  }

  writeObservation(contract.id, observed);
});
