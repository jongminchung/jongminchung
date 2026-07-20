import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  REBASED_BASELINE,
  extractPersistentList,
  extractRebasedSourceOracle,
  scanXml,
} from "./extract-rebased-source.mjs";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

void test("XML scanner ignores commented declarations and keeps source lines", () => {
  const elements = scanXml(`
<idea-plugin>
  <!-- <actions><action id="Commented"/></actions> -->
  <actions resource-bundle="messages.Test">
    <group id="Root">
      <action
        id="Real"
        class="example.RealAction"/>
      <add-to-group group-id="MainMenu" anchor="first"/>
    </group>
  </actions>
</idea-plugin>`);
  assert.equal(elements.filter((element) => element.name === "action").length, 1);
  assert.equal(elements.find((element) => element.name === "action")?.attrs.id, "Real");
  assert.equal(elements.find((element) => element.name === "action")?.line, 6);
});

void test("Kotlin persistent list extraction excludes comments", () => {
  const values = extractPersistentList(
    `val ITEMS = persistentListOf(
      "first",
      // "disabled",
      "second",
    )`,
    "ITEMS",
  );
  assert.deepEqual(values, ["first", "second"]);
});

void test("Rebased 1.1.8 source oracle is complete and deterministic", { timeout: 120_000 }, () => {
  const first = extractRebasedSourceOracle({
    workspaceRoot,
    write: false,
  });
  const second = extractRebasedSourceOracle({
    workspaceRoot,
    write: false,
  });
  assert.deepEqual(first.files, second.files);
  assert.deepEqual(first.summary.baseline, REBASED_BASELINE);
  assert.equal(first.summary.counts.bundledPlugins, 14);
  assert.equal(first.summary.counts.nonImlModules, 13);
  assert.equal(first.summary.counts.unresolvedModules, 0);
  assert.equal(first.summary.counts.unresolvedIncludes, 0);
  assert.equal(
    first.files["product-closure.json"].nonImlModules.every(
      (module) => module.classification !== "unresolved",
    ),
    true,
  );
  assert.ok(first.summary.counts.actions > 1_000);
  assert.ok(first.summary.counts.groups > 300);
  assert.ok(first.summary.counts.keymaps >= 10);
  assert.ok(first.summary.counts.toolWindows >= 7);
  assert.ok(first.summary.counts.configurables >= 20);
  assert.ok(first.summary.counts.dynamicProviders > 20);
  assert.equal(first.summary.counts.themes, 10);
  assert.ok(first.summary.counts.icons > 100);
  const icons = first.files["icons.json"].icons;
  assert.equal(new Set(icons.map((icon) => icon.stableId)).size, icons.length);
  assert.equal(
    icons.every(
      (icon) =>
        typeof icon.reference === "string" &&
        icon.reference !== "[object Object]" &&
        icon.occurrences.length > 0,
    ),
    true,
  );
  assert.equal(
    first.files["actions.json"].actions.some((action) => action.id === "Git.Fetch"),
    true,
  );
  assert.equal(
    first.files["groups.json"].groups.some((group) => group.id === "Git.Menu"),
    true,
  );
  assert.equal(
    first.files["themes.json"].themes.some((theme) => theme.name === "Islands Light"),
    true,
  );
  assert.equal(
    first.files["dynamic-providers.json"].providers.some((provider) =>
      provider.className.includes("GitBranchesTreePopup"),
    ),
    true,
  );
});
