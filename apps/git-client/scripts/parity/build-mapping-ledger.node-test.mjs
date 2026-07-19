import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
    DEFAULT_PARITY_ROOT,
    buildMappingLedgers,
    collectSourceObligations,
    loadMappingInputs,
} from "./build-mapping-ledger.mjs";

const inputs = loadMappingInputs(DEFAULT_PARITY_ROOT);

void test("collects deterministic unique obligations without expanding icons", () => {
    const first = collectSourceObligations(inputs.source);
    const second = collectSourceObligations(inputs.source);
    assert.deepEqual(first, second);
    assert.ok(first.length > 1_000);
    assert.equal(
        new Set(first.map((entry) => entry.stableId)).size,
        first.length,
    );

    const sourceIcons = JSON.parse(
        readFileSync(`${DEFAULT_PARITY_ROOT}/source/icons.json`, "utf8"),
    ).icons;
    const iconObligations = first.filter((entry) => entry.kind === "icon");
    assert.equal(iconObligations.length, sourceIcons.length);
    assert.equal(
        iconObligations.reduce(
            (total, entry) => total + entry.sourceOccurrenceCount,
            0,
        ),
        sourceIcons.reduce((total, icon) => total + icon.occurrences.length, 0),
    );

    const bookmarks = first.find(
        (entry) => entry.stableId === "toolwindow:Bookmarks",
    );
    assert.equal(bookmarks.declarationCount, 2);
});

void test("links captured runtime surfaces and source-classifies internal declarations", () => {
    const first = buildMappingLedgers(inputs);
    const second = buildMappingLedgers(inputs);
    assert.deepEqual(first, second);

    const observed = first.sourceToRuntime.entries.filter(
        (entry) => entry.status === "observed",
    );
    assert.deepEqual(
        observed.map((entry) => entry.sourceId),
        [
            "action:About",
            "action:CheckForUpdate",
            "action:Exit",
            "action:ShowSettings",
            "group:CodeMenu",
            "group:EditMenu",
            "group:FileMenu",
            "group:Git.Menu",
            "group:GoToMenu",
            "group:HelpMenu",
            "group:RunMenu",
            "group:ToolsMenu",
            "group:ViewMenu",
            "group:WindowMenu",
            "toolwindow:Project",
            "toolwindow:Terminal",
            "toolwindow:Version Control",
        ],
    );
    assert.equal(first.sourceToRuntime.summary.mapped, 17);
    assert.equal(first.sourceToRuntime.summary.observed, 17);
    assert.equal(first.sourceToRuntime.summary.classified, 202);
    assert.equal(first.sourceToRuntime.summary.resolved, 219);
    assert.ok(first.sourceToRuntime.summary.total > 3);
    assert.ok(first.sourceToRuntime.summary.notCaptured > 0);
    assert.ok(first.sourceToRuntime.summary.percentMapped < 100);
    assert.ok(first.sourceToRuntime.summary.percentResolved > 0);
    assert.equal(first.sourceToRuntime.summary.complete, false);

    const internal = first.sourceToRuntime.entries.filter(
        (entry) => entry.classification === "internal/test-only",
    );
    assert.equal(internal.length, 202);
    assert.ok(internal.every((entry) => entry.status === "classified"));

    assert.equal(first.runtimeToSource.summary.mapped, 14);
    assert.ok(first.runtimeToSource.summary.notCaptured > 0);
    assert.ok(first.runtimeToSource.summary.percentMapped < 100);
    assert.equal(
        first.runtimeToSource.scope.actionableNodeEnumerationComplete,
        false,
    );
});

void test("checked-in ledgers exactly match the deterministic builder", () => {
    const built = buildMappingLedgers(inputs);
    const sourceToRuntime = JSON.parse(
        readFileSync(
            `${DEFAULT_PARITY_ROOT}/mappings/source-to-runtime.json`,
            "utf8",
        ),
    );
    const runtimeToSource = JSON.parse(
        readFileSync(
            `${DEFAULT_PARITY_ROOT}/mappings/runtime-to-source.json`,
            "utf8",
        ),
    );
    assert.deepEqual(sourceToRuntime, built.sourceToRuntime);
    assert.deepEqual(runtimeToSource, built.runtimeToSource);
});
