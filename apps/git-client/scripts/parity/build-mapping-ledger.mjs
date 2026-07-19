#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
    closeSync,
    existsSync,
    fsyncSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PARITY_ROOT = resolve(
    SCRIPT_DIRECTORY,
    "../../parity/rebased/1.1.8",
);

const SOURCE_FILES = Object.freeze([
    "actions.json",
    "add-to-groups.json",
    "configurables.json",
    "dynamic-providers.json",
    "groups.json",
    "icons.json",
    "keymaps.json",
    "product-closure.json",
    "themes.json",
    "tool-windows.json",
]);

const OBSERVED_RUNTIME_MAPPINGS = Object.freeze([
    {
        runtimeId: "runtime-surface:workbench.project",
        kind: "tool-window-surface",
        sourceId: "toolwindow:Project",
        label: "Project",
        evidence: [
            {
                accessibility:
                    "runtime/workbench/log/golden-1.1.8/reference.ax.json",
                fingerprint: {
                    accessibleName: "Project Tool Window",
                    role: "AXGroup",
                    surface: "workbench.log",
                },
                screenshot: "runtime/workbench/log/golden-1.1.8/reference.png",
            },
        ],
        mappingBasis:
            "The authoritative 1.1.8 AX capture exposes the Project Tool Window and its Project structure tree.",
    },
    {
        runtimeId: "runtime-surface:terminal.local",
        kind: "tool-window-surface",
        sourceId: "toolwindow:Terminal",
        label: "Terminal / Local",
        evidence: [
            {
                accessibility:
                    "runtime/terminal/local/golden-1.1.8/reference-empty.ax.json",
                fingerprint: {
                    accessibleName: "Local Tool Window",
                    role: "AXGroup",
                    surface: "terminal.local.empty",
                },
                screenshot:
                    "runtime/terminal/local/golden-1.1.8/reference-empty.png",
            },
            {
                accessibility:
                    "runtime/terminal/local/golden-1.1.8/reference-pwd.ax.json",
                fingerprint: {
                    accessibleName: "Local Tool Window",
                    role: "AXGroup",
                    siblingLabels: ["Terminal", "Local"],
                    surface: "terminal.local.pwd",
                },
                screenshot:
                    "runtime/terminal/local/golden-1.1.8/reference-pwd.png",
            },
        ],
        mappingBasis:
            "The authoritative captures expose the Terminal tool window, Local tab, terminal editor focus, and a completed pwd interaction.",
    },
    {
        runtimeId: "runtime-surface:workbench.log",
        kind: "tool-window-content-surface",
        sourceId: "toolwindow:Version Control",
        label: "Log",
        evidence: [
            {
                accessibility:
                    "runtime/workbench/log/golden-1.1.8/reference.ax.json",
                fingerprint: {
                    accessibleName: "Log",
                    role: "AXTabGroup",
                    surface: "workbench.log",
                },
                screenshot: "runtime/workbench/log/golden-1.1.8/reference.png",
            },
        ],
        mappingBasis:
            "The authoritative workbench capture exposes the Log content hosted by the Version Control tool window. Individual Log controls are not mapped by this entry.",
    },
]);

const UNCAPTURED_RUNTIME_SCOPES = Object.freeze([
    ["application-menus", "All application menus and recursive submenus"],
    ["context-menus", "All context-menu providers and generated rows"],
    ["dialogs", "Dialogs, validation states, focus loops, and cancellation"],
    ["notifications", "Notifications and notification actions"],
    ["settings", "Settings, keymap, themes, compact mode, and persistence"],
    ["editor-diff", "Editor, file viewer, search, diff, history, and blame"],
    ["git-flows", "Mutating Git flows and before/after side effects"],
    ["forge-flows", "GitHub Pull Requests and GitLab Merge Requests"],
]);

function compareText(left, right) {
    return String(left).localeCompare(String(right), "en");
}

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => compareText(left, right))
            .map(([key, child]) => [key, stableValue(child)]),
    );
}

function stableJson(value) {
    return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}

function encoded(value) {
    return encodeURIComponent(String(value));
}

function sourceLocations(value, locations = new Map()) {
    if (!value || typeof value !== "object") return [...locations.values()];
    if (
        typeof value.path === "string" &&
        Number.isInteger(value.line) &&
        value.line > 0
    ) {
        const location = {
            blob: typeof value.blob === "string" ? value.blob : null,
            line: value.line,
            path: value.path,
        };
        locations.set(`${location.path}:${location.line}`, location);
    }
    for (const child of Object.values(value)) {
        sourceLocations(child, locations);
    }
    return [...locations.values()].sort((left, right) =>
        compareText(
            `${left.path}:${String(left.line).padStart(10, "0")}`,
            `${right.path}:${String(right.line).padStart(10, "0")}`,
        ),
    );
}

function shortcutIdentity(keymap, actionId, shortcut) {
    const definition = Object.fromEntries(
        Object.entries(shortcut)
            .filter(([key]) => !["actionId", "keymap", "source"].includes(key))
            .sort(([left], [right]) => compareText(left, right)),
    );
    const query = Object.entries(definition)
        .map(([key, value]) => `${encoded(key)}=${encoded(value)}`)
        .join("&");
    return `shortcut:${encoded(keymap)}/${encoded(actionId)}?${query}`;
}

function placementIdentity(placement) {
    return [
        "placement",
        encoded(placement.ownerType),
        encoded(placement.ownerId),
        encoded(placement.groupId),
        encoded(placement.anchor ?? "last"),
        encoded(placement.relativeToAction ?? ""),
    ].join(":");
}

function addObligation(
    obligations,
    {
        stableId,
        kind,
        sourceFile,
        record,
        value,
        details,
        occurrenceWeight = 1,
    },
) {
    if (!stableId || typeof stableId !== "string") {
        throw new Error(`Missing stable ID for ${sourceFile}:${record}`);
    }
    if (!Number.isInteger(occurrenceWeight) || occurrenceWeight < 1) {
        throw new Error(`Invalid occurrence count for ${stableId}`);
    }
    const current = obligations.get(stableId) ?? {
        stableId,
        kind,
        declarations: [],
        sourceOccurrenceCount: 0,
    };
    if (current.kind !== kind) {
        throw new Error(
            `Stable ID ${stableId} is shared by ${current.kind} and ${kind}`,
        );
    }
    current.declarations.push({
        details,
        occurrenceCount: occurrenceWeight,
        record,
        sourceFile,
        sourceLocations: sourceLocations(value),
    });
    current.sourceOccurrenceCount += occurrenceWeight;
    obligations.set(stableId, current);
}

function addRecordList(
    obligations,
    records,
    { kind, sourceFile, recordName, details },
) {
    for (const record of records) {
        addObligation(obligations, {
            details: details(record),
            kind,
            record: `${recordName}:${record.stableId}`,
            sourceFile,
            stableId: record.stableId,
            value: record,
        });
    }
}

function normalizeObligations(obligations) {
    return [...obligations.values()]
        .map((obligation) => ({
            declarationCount: obligation.declarations.length,
            declarations: obligation.declarations.sort((left, right) =>
                compareText(
                    `${left.sourceFile}:${left.record}:${JSON.stringify(left.details)}`,
                    `${right.sourceFile}:${right.record}:${JSON.stringify(right.details)}`,
                ),
            ),
            kind: obligation.kind,
            sourceOccurrenceCount: obligation.sourceOccurrenceCount,
            stableId: obligation.stableId,
        }))
        .sort((left, right) => compareText(left.stableId, right.stableId));
}

/**
 * Converts the extracted Source Oracle into unique, stable obligations.
 * Derived views (effectiveMacOS, roots, descriptors, include edges) remain
 * provenance and do not create duplicate semantic obligations.
 */
export function collectSourceObligations(source) {
    const obligations = new Map();

    addRecordList(obligations, source.actions.actions, {
        details: (record) => ({
            className: record.className,
            id: record.id,
            internal: record.internal,
            text: record.text,
        }),
        kind: "action",
        recordName: "action",
        sourceFile: "source/actions.json",
    });
    addRecordList(obligations, source.groups.groups, {
        details: (record) => ({
            className: record.className,
            id: record.id,
            internal: record.internal,
            popup: record.popup,
            text: record.text,
        }),
        kind: "group",
        recordName: "group",
        sourceFile: "source/groups.json",
    });

    for (const placement of source.addToGroups.placements) {
        addObligation(obligations, {
            details: {
                anchor: placement.anchor,
                groupId: placement.groupId,
                ownerId: placement.ownerId,
                ownerType: placement.ownerType,
                relativeToAction: placement.relativeToAction,
            },
            kind: "action-placement",
            record: `placement:${placement.ownerType}:${placement.ownerId}`,
            sourceFile: "source/add-to-groups.json",
            stableId: placementIdentity(placement),
            value: placement,
        });
    }

    addRecordList(obligations, source.configurables.configurables, {
        details: (record) => ({
            attributes: record.attributes,
            scope: record.scope,
        }),
        kind: "configurable",
        recordName: "configurable",
        sourceFile: "source/configurables.json",
    });
    addRecordList(obligations, source.dynamicProviders.providers, {
        details: (record) => ({ className: record.className }),
        kind: "dynamic-provider",
        recordName: "dynamic-provider",
        sourceFile: "source/dynamic-providers.json",
    });
    addRecordList(obligations, source.toolWindows.toolWindows, {
        details: (record) => ({
            attributes: record.attributes,
            extensionKind: record.kind,
        }),
        kind: "tool-window",
        recordName: "tool-window",
        sourceFile: "source/tool-windows.json",
    });
    addRecordList(obligations, source.themes.themes, {
        details: (record) => ({
            dark: record.dark,
            id: record.id,
            name: record.name,
            targetUi: record.targetUi,
        }),
        kind: "theme",
        recordName: "theme",
        sourceFile: "source/themes.json",
    });

    for (const scheme of source.themes.colorSchemes) {
        const id = scheme.attributes.id ?? scheme.attributes.path;
        addObligation(obligations, {
            details: { attributes: scheme.attributes, paths: scheme.paths },
            kind: "color-scheme",
            record: `color-scheme:${id}`,
            sourceFile: "source/themes.json",
            stableId: `color-scheme:${id}`,
            value: scheme,
        });
    }

    for (const icon of source.icons.icons) {
        addObligation(obligations, {
            details: {
                reference: icon.reference,
                reusable: icon.reusable,
            },
            kind: "icon",
            occurrenceWeight: icon.occurrences.length,
            record: `icon:${icon.stableId}`,
            sourceFile: "source/icons.json",
            stableId: icon.stableId,
            value: icon,
        });
    }

    for (const registration of source.keymaps.registrations) {
        addObligation(obligations, {
            details: { file: registration.file, paths: registration.paths },
            kind: "keymap-registration",
            record: `keymap-registration:${registration.file}`,
            sourceFile: "source/keymaps.json",
            stableId: `keymap-registration:${registration.file}`,
            value: registration,
        });
    }
    for (const keymap of source.keymaps.keymaps) {
        addObligation(obligations, {
            details: {
                disableMnemonics: keymap.disableMnemonics,
                name: keymap.name,
                parent: keymap.parent,
                path: keymap.path,
            },
            kind: "keymap",
            record: `keymap:${keymap.name}`,
            sourceFile: "source/keymaps.json",
            stableId: `keymap:${keymap.name}`,
            value: keymap,
        });
        for (const action of keymap.actions) {
            addObligation(obligations, {
                details: { actionId: action.id, keymap: keymap.name },
                kind: "keymap-action",
                record: `keymap-action:${keymap.name}:${action.id}`,
                sourceFile: "source/keymaps.json",
                stableId: `keymap-action:${encoded(keymap.name)}/${encoded(action.id)}`,
                value: action,
            });
            for (const shortcut of action.shortcuts) {
                addObligation(obligations, {
                    details: {
                        actionId: action.id,
                        keymap: keymap.name,
                        shortcut,
                    },
                    kind: "shortcut",
                    record: `keymap-shortcut:${keymap.name}:${action.id}`,
                    sourceFile: "source/keymaps.json",
                    stableId: shortcutIdentity(
                        keymap.name,
                        action.id,
                        shortcut,
                    ),
                    value: { ...shortcut, source: action.source },
                });
            }
        }
    }
    for (const shortcut of source.keymaps.descriptorShortcuts) {
        const keymap = shortcut.keymap ?? "$default";
        addObligation(obligations, {
            details: {
                actionId: shortcut.actionId,
                keymap,
                shortcut: Object.fromEntries(
                    Object.entries(shortcut).filter(
                        ([key]) => !["actionId", "source"].includes(key),
                    ),
                ),
            },
            kind: "shortcut",
            record: `descriptor-shortcut:${keymap}:${shortcut.actionId}`,
            sourceFile: "source/keymaps.json",
            stableId: shortcutIdentity(keymap, shortcut.actionId, shortcut),
            value: shortcut,
        });
    }

    for (const plugin of source.productClosure.bundledPlugins) {
        addObligation(obligations, {
            details: {
                contentModuleCount: plugin.contentModules.length,
                descriptor: plugin.descriptor,
                name: plugin.name,
            },
            kind: "bundled-plugin",
            record: `bundled-plugin:${plugin.name}`,
            sourceFile: "source/product-closure.json",
            stableId: `plugin:${plugin.name}`,
            value: plugin,
        });
        for (const module of plugin.contentModules) {
            addObligation(obligations, {
                details: {
                    loading: module.loading,
                    name: module.name,
                    ownerPlugin: plugin.name,
                    requiredIfAvailable: module.requiredIfAvailable,
                },
                kind: "module",
                record: `plugin-content-module:${plugin.name}:${module.name}`,
                sourceFile: "source/product-closure.json",
                stableId: `module:${module.name}`,
                value: plugin,
            });
        }
    }
    for (const module of source.productClosure.activeModules) {
        addObligation(obligations, {
            details: {
                descriptorCount: module.descriptors.length,
                iml: module.iml,
                name: module.name,
            },
            kind: "module",
            record: `active-module:${module.name}`,
            sourceFile: "source/product-closure.json",
            stableId: `module:${module.name}`,
            value: module,
        });
    }
    for (const module of source.productClosure.nonImlModules) {
        addObligation(obligations, {
            details: {
                classification: module.classification,
                name: module.name,
            },
            kind: "module",
            record: `non-iml-module:${module.name}`,
            sourceFile: "source/product-closure.json",
            stableId: `module:${module.name}`,
            value: module,
        });
    }

    return normalizeObligations(obligations);
}

function countsByKind(obligations) {
    const counts = {};
    for (const obligation of obligations) {
        counts[obligation.kind] = (counts[obligation.kind] ?? 0) + 1;
    }
    return Object.fromEntries(
        Object.entries(counts).sort(([left], [right]) =>
            compareText(left, right),
        ),
    );
}

function percentage(numerator, denominator) {
    if (denominator === 0) return 0;
    return Number(((numerator / denominator) * 100).toFixed(6));
}

function referenceMetadata(baseline) {
    return {
        artifactSha256: baseline.reference.artifact.sha256,
        build: baseline.reference.build,
        product: baseline.reference.product,
        tagSha: baseline.reference.tagSha,
        version: baseline.reference.version,
    };
}

function hasOnlyInternalDeclarations(obligation) {
    return (
        (obligation.kind === "action" || obligation.kind === "group") &&
        obligation.declarations.length > 0 &&
        obligation.declarations.every(
            (declaration) => declaration.details.internal === true,
        )
    );
}

export function buildMappingLedgers({ baseline, runtimeObservations, source }) {
    const obligations = collectSourceObligations(source);
    const observations = runtimeObservations
        ? runtimeObservations.observations
        : OBSERVED_RUNTIME_MAPPINGS.map((mapping) => ({
              ...mapping,
              sourceIds: [mapping.sourceId],
          }));
    const observedBySource = new Map();
    for (const observation of observations) {
        for (const sourceId of observation.sourceIds) {
            if (observedBySource.has(sourceId)) {
                throw new Error(
                    `Source obligation has multiple runtime observations: ${sourceId}`,
                );
            }
            observedBySource.set(sourceId, observation);
        }
    }
    for (const sourceId of observedBySource.keys()) {
        if (
            !obligations.some((obligation) => obligation.stableId === sourceId)
        ) {
            throw new Error(
                `Observed source obligation is missing: ${sourceId}`,
            );
        }
    }

    const sourceEntries = obligations.map((obligation) => {
        const mapping = observedBySource.get(obligation.stableId);
        const internal = !mapping && hasOnlyInternalDeclarations(obligation);
        return {
            classification: mapping
                ? "observed"
                : internal
                  ? "internal/test-only"
                  : "unresolved",
            declarationCount: obligation.declarationCount,
            declarationDigest: sha256(stableJson(obligation.declarations)),
            evidence: mapping ? mapping.evidence : [],
            kind: obligation.kind,
            reason: mapping
                ? mapping.mappingBasis
                : internal
                  ? "Every Rebased 1.1.8 source declaration marks this action or group internal=true; it is classified as internal/test-only rather than a user-reachable runtime obligation."
                : "No authoritative Rebased 1.1.8 runtime evidence is linked to this source obligation yet.",
            runtimeIds: mapping ? [mapping.runtimeId] : [],
            sourceFiles: [
                ...new Set(
                    obligation.declarations.map(
                        (declaration) => declaration.sourceFile,
                    ),
                ),
            ].sort(compareText),
            sourceId: obligation.stableId,
            sourceOccurrenceCount: obligation.sourceOccurrenceCount,
            status: mapping ? "observed" : internal ? "classified" : "not-captured",
        };
    });
    const observedSourceCount = sourceEntries.filter(
        (entry) => entry.status === "observed",
    ).length;
    const classifiedSourceCount = sourceEntries.filter(
        (entry) => entry.status === "classified",
    ).length;
    const resolvedSourceCount = observedSourceCount + classifiedSourceCount;
    const unresolvedSourceCount = sourceEntries.length - resolvedSourceCount;
    const sourceDeclarationCount = obligations.reduce(
        (total, obligation) => total + obligation.declarationCount,
        0,
    );
    const sourceOccurrenceCount = obligations.reduce(
        (total, obligation) => total + obligation.sourceOccurrenceCount,
        0,
    );

    const runtimeEntries = [
        ...observations.map((mapping) => ({
            evidence: mapping.evidence,
            kind: mapping.kind,
            label: mapping.label,
            mappingBasis: mapping.mappingBasis,
            runtimeId: mapping.runtimeId,
            sourceIds: mapping.sourceIds,
            status: "mapped",
        })),
        ...UNCAPTURED_RUNTIME_SCOPES.map(([id, label]) => ({
            evidence: [],
            kind: "capture-scope",
            label,
            mappingBasis:
                "This runtime scope has not been exhaustively enumerated from authoritative 1.1.8 evidence.",
            runtimeId: `runtime-scope:${id}`,
            sourceIds: [],
            status: "not-captured",
        })),
    ].sort((left, right) => compareText(left.runtimeId, right.runtimeId));
    const mappedRuntimeCount = runtimeEntries.filter(
        (entry) => entry.status === "mapped",
    ).length;

    const reference = referenceMetadata(baseline);
    const sourceToRuntime = {
        schemaVersion: 2,
        reference,
        generatedBy: "scripts/parity/build-mapping-ledger.mjs",
        scope: {
            complete: false,
            normalization: [
                "Duplicate source declarations with one stableId are one obligation with multiple declarations.",
                "icons.json already contains unique stableId records; icon occurrences contribute occurrence counts and are not expanded into obligations.",
                "effectiveMacOS, descriptor/include graphs, and source/resource roots are derived provenance and do not create duplicate semantic obligations.",
                "Runtime links are loaded from manifest/runtime-observations.json and require existing 1.1.8 AX and screenshot evidence.",
            ],
            status: "in-progress",
        },
        inventory: {
            byKind: countsByKind(obligations),
            sourceDeclarationCount,
            sourceOccurrenceCount,
            uniqueObligationCount: obligations.length,
        },
        summary: {
            classified: classifiedSourceCount,
            complete: unresolvedSourceCount === 0,
            mapped: observedSourceCount,
            notCaptured: unresolvedSourceCount,
            observed: observedSourceCount,
            percentMapped: percentage(observedSourceCount, sourceEntries.length),
            percentResolved: percentage(resolvedSourceCount, sourceEntries.length),
            resolved: resolvedSourceCount,
            total: sourceEntries.length,
            unresolved: unresolvedSourceCount,
        },
        entries: sourceEntries,
    };
    const runtimeToSource = {
        schemaVersion: 2,
        reference,
        generatedBy: "scripts/parity/build-mapping-ledger.mjs",
        scope: {
            actionableNodeEnumerationComplete: false,
            complete: false,
            note: "Mapped surfaces are evidence-backed. Remaining runtime scopes are explicit placeholders, not claims that their actionable nodes have been enumerated.",
            status: "in-progress",
        },
        summary: {
            complete: false,
            mapped: mappedRuntimeCount,
            notCaptured: runtimeEntries.length - mappedRuntimeCount,
            percentMapped: percentage(
                mappedRuntimeCount,
                runtimeEntries.length,
            ),
            total: runtimeEntries.length,
            unmappedRuntime: runtimeEntries.length - mappedRuntimeCount,
        },
        entries: runtimeEntries,
    };

    return { runtimeToSource, sourceToRuntime };
}

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function loadMappingInputs(parityRoot = DEFAULT_PARITY_ROOT) {
    const source = {};
    const keys = {
        "actions.json": "actions",
        "add-to-groups.json": "addToGroups",
        "configurables.json": "configurables",
        "dynamic-providers.json": "dynamicProviders",
        "groups.json": "groups",
        "icons.json": "icons",
        "keymaps.json": "keymaps",
        "product-closure.json": "productClosure",
        "themes.json": "themes",
        "tool-windows.json": "toolWindows",
    };
    for (const file of SOURCE_FILES) {
        source[keys[file]] = readJson(join(parityRoot, "source", file));
    }
    const baseline = readJson(join(parityRoot, "baseline.json"));
    const runtimeObservations = readJson(
        join(parityRoot, "manifest", "runtime-observations.json"),
    );
    if (
        runtimeObservations.schemaVersion !== 1 ||
        !Array.isArray(runtimeObservations.observations)
    ) {
        throw new Error("Runtime observations must use schema version 1");
    }
    const expected = {
        build: baseline.reference.build.replace(/^IC-/, ""),
        commit: baseline.reference.tagSha,
        tag: baseline.reference.version,
    };
    for (const [key, document] of Object.entries(source)) {
        if (JSON.stringify(document.baseline) !== JSON.stringify(expected)) {
            throw new Error(`Source baseline mismatch in ${key}`);
        }
    }
    for (const mapping of runtimeObservations.observations) {
        if (!Array.isArray(mapping.sourceIds) || mapping.sourceIds.length === 0) {
            throw new Error(
                `Runtime observation has no source IDs: ${String(mapping.runtimeId)}`,
            );
        }
        for (const evidence of mapping.evidence) {
            for (const evidencePath of [
                evidence.accessibility,
                evidence.screenshot,
            ]) {
                if (!existsSync(join(parityRoot, evidencePath))) {
                    throw new Error(
                        `Missing runtime evidence: ${evidencePath}`,
                    );
                }
            }
            const accessibility = readFileSync(
                join(parityRoot, evidence.accessibility),
                "utf8",
            );
            if (!accessibility.includes(evidence.fingerprint.accessibleName)) {
                throw new Error(
                    `AX evidence ${evidence.accessibility} does not contain ${evidence.fingerprint.accessibleName}`,
                );
            }
        }
    }
    return { baseline, runtimeObservations, source };
}

function writeAtomicBatch(directory, files) {
    mkdirSync(directory, { recursive: true });
    const stagingDirectory = mkdtempSync(join(directory, ".ledger-"));
    try {
        const staged = [];
        for (const [name, value] of Object.entries(files)) {
            const target = join(stagingDirectory, name);
            const descriptor = openSync(target, "wx", 0o644);
            try {
                writeFileSync(descriptor, stableJson(value), "utf8");
                fsyncSync(descriptor);
            } finally {
                closeSync(descriptor);
            }
            staged.push([target, join(directory, name)]);
        }
        for (const [temporary, target] of staged) {
            renameSync(temporary, target);
        }
    } finally {
        rmSync(stagingDirectory, { force: true, recursive: true });
    }
}

export function generateMappingLedgers(parityRoot = DEFAULT_PARITY_ROOT) {
    const inputs = loadMappingInputs(parityRoot);
    const ledgers = buildMappingLedgers(inputs);
    writeAtomicBatch(join(parityRoot, "mappings"), {
        "runtime-to-source.json": ledgers.runtimeToSource,
        "source-to-runtime.json": ledgers.sourceToRuntime,
    });
    return ledgers;
}

function parseArguments(arguments_) {
    let parityRoot = DEFAULT_PARITY_ROOT;
    for (let index = 0; index < arguments_.length; index += 1) {
        if (arguments_[index] !== "--parity-root") {
            throw new Error(`Unknown argument: ${arguments_[index]}`);
        }
        const value = arguments_[index + 1];
        if (!value) throw new Error("--parity-root requires a path");
        parityRoot = resolve(value);
        index += 1;
    }
    return { parityRoot };
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
    const { parityRoot } = parseArguments(process.argv.slice(2));
    const { sourceToRuntime, runtimeToSource } =
        generateMappingLedgers(parityRoot);
    process.stdout.write(
        stableJson({
            runtimeToSource: runtimeToSource.summary,
            sourceDigest: sha256(stableJson(sourceToRuntime.entries)),
            sourceToRuntime: sourceToRuntime.summary,
        }),
    );
}
