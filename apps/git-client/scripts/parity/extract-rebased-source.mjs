#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REBASED_BASELINE = Object.freeze({
    tag: "1.1.8",
    commit: "12fb12778a5ad8b7c52b64931a81c648629c9e23",
    build: "262.8665.SNAPSHOT",
});

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE_ROOT = resolve(SCRIPT_DIRECTORY, "../../../..");
const PRODUCT_LAYOUT_FILES = Object.freeze({
    rebasedProperties:
        "build/src/org/jetbrains/intellij/build/RebasedProperties.kt",
    baseIdeaProperties:
        "platform/build-scripts/src/org/jetbrains/intellij/build/BaseIdeaProperties.kt",
    productModulesLayout:
        "platform/build-scripts/src/org/jetbrains/intellij/build/productLayout/ProductModulesLayout.kt",
    communityModuleSets:
        "platform/build-scripts/src/org/jetbrains/intellij/build/productLayout/CommunityModuleSets.kt",
    generatedIdeCommon:
        "platform/platform-resources/generated/META-INF/intellij.moduleSets.ide.common.xml",
    platformLangPlugin:
        "platform/platform-resources/src/META-INF/PlatformLangPlugin.xml",
    communityCustomization:
        "community-resources/resources/META-INF/community-customization.xml",
    applicationInfo:
        "community-resources/resources/idea/RebasedApplicationInfo.xml",
});
const EXTRA_RESOURCE_ROOTS = Object.freeze([
    "platform/icons/src",
    "platform/icons/compatibilityResources",
    "community-resources/resources",
]);
const ICON_CLASS_FILES = Object.freeze({
    AllIcons: "platform/util/ui/src/com/intellij/icons/AllIcons.java",
    CollaborationToolsIcons:
        "platform/collaboration-tools/gen/icons/CollaborationToolsIcons.java",
    DvcsImplIcons: "platform/dvcs-impl/shared/src/icons/DvcsImplIcons.java",
    GitIcons:
        "plugins/git4idea/backend/gen/com/intellij/vcs/git/icons/GitIcons.java",
    GithubIcons:
        "plugins/github/github-core/gen/org/jetbrains/plugins/github/GithubIcons.java",
    GitlabIcons:
        "plugins/gitlab/gitlab-core/gen/com/intellij/vcs/gitlab/icons/GitlabIcons.java",
    PlatformVcsImplIcons:
        "platform/vcs-impl/gen/com/intellij/platform/vcs/impl/icons/PlatformVcsImplIcons.java",
    TerminalIcons:
        "plugins/terminal/src/com/intellij/terminal/icons/TerminalIcons.java",
    VcsLogIcons: "platform/vcs-log/impl/gen/icons/VcsLogIcons.java",
});
const OUTPUT_FILES = Object.freeze([
    "actions.json",
    "add-to-groups.json",
    "configurables.json",
    "dynamic-providers.json",
    "groups.json",
    "icons.json",
    "keymaps.json",
    "product-closure.json",
    "summary.json",
    "themes.json",
    "tool-windows.json",
]);

function run(command, args, options = {}) {
    return execFileSync(command, args, {
        encoding: "utf8",
        maxBuffer: 128 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        ...options,
    });
}

function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}

function compareText(left, right) {
    return String(left).localeCompare(String(right), "en");
}

function stableSort(values, key) {
    return [...values].sort((left, right) => {
        const primary = compareText(key(left), key(right));
        if (primary !== 0) return primary;
        return compareText(JSON.stringify(left), JSON.stringify(right));
    });
}

function sortedRecord(record) {
    return Object.fromEntries(
        Object.entries(record)
            .sort(([left], [right]) => compareText(left, right))
            .map(([key, value]) => [key, stableValue(value)]),
    );
}

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") return sortedRecord(value);
    return value;
}

function stableJson(value) {
    return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function lineNumberAt(lineStarts, offset) {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (lineStarts[middle] <= offset) low = middle;
        else high = middle;
    }
    return low + 1;
}

function lineStarts(source) {
    const starts = [0];
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === "\n") starts.push(index + 1);
    }
    return starts;
}

function blankXmlComments(source) {
    return source.replace(/<!--[\s\S]*?-->/g, (comment) =>
        comment.replace(/[^\n]/g, " "),
    );
}

function decodeXml(value) {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
            String.fromCodePoint(Number.parseInt(hex, 16)),
        )
        .replace(/&#([0-9]+);/g, (_, decimal) =>
            String.fromCodePoint(Number.parseInt(decimal, 10)),
        )
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

function parseAttributes(source) {
    const attributes = {};
    let offset = 0;
    while (offset < source.length) {
        while (/\s/.test(source[offset] ?? "")) offset += 1;
        const nameMatch = /^[^\s=/>]+/.exec(source.slice(offset));
        if (!nameMatch) break;
        const name = nameMatch[0];
        offset += name.length;
        while (/\s/.test(source[offset] ?? "")) offset += 1;
        if (source[offset] !== "=") {
            attributes[name] = "true";
            continue;
        }
        offset += 1;
        while (/\s/.test(source[offset] ?? "")) offset += 1;
        const quote = source[offset];
        if (quote !== '"' && quote !== "'") {
            const valueMatch = /^[^\s/>]+/.exec(source.slice(offset));
            attributes[name] = decodeXml(valueMatch?.[0] ?? "");
            offset += valueMatch?.[0].length ?? 0;
            continue;
        }
        offset += 1;
        const end = source.indexOf(quote, offset);
        if (end < 0) throw new Error(`Unterminated XML attribute ${name}`);
        attributes[name] = decodeXml(source.slice(offset, end));
        offset = end + 1;
    }
    return sortedRecord(attributes);
}

/** A small non-validating XML scanner sufficient for IntelliJ descriptors. */
export function scanXml(source, sourcePath = "<memory>") {
    const sanitized = blankXmlComments(source);
    const starts = lineStarts(sanitized);
    const elements = [];
    const stack = [];
    let offset = 0;

    while (offset < sanitized.length) {
        const opening = sanitized.indexOf("<", offset);
        if (opening < 0) break;
        if (sanitized.startsWith("<![CDATA[", opening)) {
            const end = sanitized.indexOf("]]>", opening + 9);
            offset = end < 0 ? sanitized.length : end + 3;
            continue;
        }
        let quote = null;
        let closing = opening + 1;
        for (; closing < sanitized.length; closing += 1) {
            const character = sanitized[closing];
            if (quote) {
                if (character === quote) quote = null;
            } else if (character === '"' || character === "'") {
                quote = character;
            } else if (character === ">") {
                break;
            }
        }
        if (closing >= sanitized.length) {
            throw new Error(
                `Unterminated XML tag in ${sourcePath}:${lineNumberAt(starts, opening)}`,
            );
        }

        let body = sanitized.slice(opening + 1, closing).trim();
        offset = closing + 1;
        if (!body || body.startsWith("?") || body.startsWith("!")) continue;
        if (body.startsWith("/")) {
            const name = body.slice(1).trim().split(/\s/, 1)[0];
            const current = stack.pop();
            if (current && elements[current].name !== name) {
                throw new Error(
                    `Mismatched XML close tag ${name} in ${sourcePath}:${lineNumberAt(starts, opening)}`,
                );
            }
            continue;
        }

        const selfClosing = body.endsWith("/");
        if (selfClosing) body = body.slice(0, -1).trimEnd();
        const nameMatch = /^[^\s/>]+/.exec(body);
        if (!nameMatch) continue;
        const name = nameMatch[0];
        const element = {
            name,
            attrs: parseAttributes(body.slice(name.length)),
            line: lineNumberAt(starts, opening),
            parent: stack.at(-1) ?? null,
        };
        elements.push(element);
        const index = elements.length - 1;
        if (!selfClosing) stack.push(index);
    }

    return elements;
}

function ancestors(elements, index) {
    const result = [];
    let parent = elements[index]?.parent ?? null;
    while (parent !== null) {
        result.push(parent);
        parent = elements[parent]?.parent ?? null;
    }
    return result;
}

function nearestAncestor(elements, index, names) {
    return (
        ancestors(elements, index).find((parent) =>
            names.has(elements[parent].name),
        ) ?? null
    );
}

function stripKotlinComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findMatchingParen(source, opening) {
    let depth = 0;
    let quote = null;
    for (let index = opening; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (character === "\\") index += 1;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '"' || character === "'") quote = character;
        else if (character === "(") depth += 1;
        else if (character === ")") {
            depth -= 1;
            if (depth === 0) return index;
        }
    }
    throw new Error("Unbalanced Kotlin call expression");
}

export function extractPersistentList(source, variableName) {
    const cleaned = stripKotlinComments(source);
    const declaration = cleaned.search(
        new RegExp(`\\bval\\s+${variableName}\\b`),
    );
    if (declaration < 0) throw new Error(`Missing Kotlin list ${variableName}`);
    const call = cleaned.indexOf("persistentListOf", declaration);
    const opening = cleaned.indexOf("(", call);
    if (call < 0 || opening < 0)
        throw new Error(`Missing persistentListOf for ${variableName}`);
    const closing = findMatchingParen(cleaned, opening);
    return [
        ...cleaned
            .slice(opening + 1, closing)
            .matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g),
    ].map((match) => JSON.parse(`"${match[1]}"`));
}

class GitTagReader {
    constructor(repository, tag) {
        this.repository = repository;
        this.tag = tag;
        this.cache = new Map();
        this.entries = new Map();
        const raw = run("git", ["-C", repository, "ls-tree", "-r", "-z", tag], {
            encoding: "buffer",
        });
        for (const entry of raw.toString("utf8").split("\0")) {
            if (!entry) continue;
            const match = /^(\d+)\s+(\w+)\s+([0-9a-f]+)\t([\s\S]+)$/.exec(
                entry,
            );
            if (!match)
                throw new Error(`Unexpected git ls-tree entry: ${entry}`);
            this.entries.set(match[4], {
                mode: match[1],
                type: match[2],
                oid: match[3],
            });
        }
        this.paths = [...this.entries.keys()].sort(compareText);
    }

    verify() {
        const commit = run("git", [
            "-C",
            this.repository,
            "rev-parse",
            "--verify",
            `${this.tag}^{commit}`,
        ]).trim();
        if (commit !== REBASED_BASELINE.commit) {
            throw new Error(
                `Rebased ${this.tag} resolves to ${commit}; expected ${REBASED_BASELINE.commit}`,
            );
        }
        const build = this.read("build.txt").trim();
        if (build !== REBASED_BASELINE.build) {
            throw new Error(
                `Rebased build is ${build}; expected ${REBASED_BASELINE.build}`,
            );
        }
        return { ...REBASED_BASELINE };
    }

    has(path) {
        return this.entries.has(path);
    }

    read(path) {
        const cached = this.cache.get(path);
        if (cached !== undefined) return cached;
        const entry = this.entries.get(path);
        if (!entry || entry.type !== "blob")
            throw new Error(`Missing Rebased blob ${path}`);
        const content = run("git", [
            "-C",
            this.repository,
            "cat-file",
            "blob",
            entry.oid,
        ]);
        this.cache.set(path, content);
        return content;
    }

    source(path, line = 1) {
        const entry = this.entries.get(path);
        return {
            path,
            line,
            blob: entry?.oid ?? null,
        };
    }
}

function moduleIndex(reader) {
    const index = new Map();
    for (const path of reader.paths.filter((candidate) =>
        candidate.endsWith(".iml"),
    )) {
        const name = posix.basename(path, ".iml");
        const existing = index.get(name) ?? [];
        existing.push(path);
        index.set(name, existing);
    }
    return index;
}

function rootsForModule(reader, imlPath) {
    const elements = scanXml(reader.read(imlPath), imlPath);
    const moduleDirectory = posix.dirname(imlPath);
    const resources = [];
    const sources = [];
    for (const element of elements.filter(
        (candidate) => candidate.name === "sourceFolder",
    )) {
        const url = element.attrs.url ?? "";
        const prefix = "file://$MODULE_DIR$/";
        if (!url.startsWith(prefix)) continue;
        const root = posix.normalize(
            posix.join(moduleDirectory, url.slice(prefix.length)),
        );
        if (element.attrs.type === "java-resource") resources.push(root);
        else if (element.attrs.isTestSource !== "true") sources.push(root);
    }
    const dependencies = elements
        .filter(
            (element) =>
                element.name === "orderEntry" &&
                element.attrs.type === "module" &&
                element.attrs["module-name"] &&
                element.attrs.scope !== "TEST",
        )
        .map((element) => element.attrs["module-name"]);
    return {
        resources: [...new Set(resources)].sort(compareText),
        sources: [...new Set(sources)].sort(compareText),
        dependencies: [...new Set(dependencies)].sort(compareText),
    };
}

function descriptorResourceBundle(source) {
    const cleaned = blankXmlComments(source);
    const match = /<resource-bundle>\s*([^<]+?)\s*<\/resource-bundle>/.exec(
        cleaned,
    );
    return match?.[1] ?? null;
}

function contentModuleRegistrations(elements) {
    return elements
        .filter((element, index) => {
            if (element.name !== "module" || !element.attrs.name) return false;
            return (
                nearestAncestor(elements, index, new Set(["content"])) !== null
            );
        })
        .map((element) => ({
            name: element.attrs.name,
            loading: element.attrs.loading ?? "on-demand",
            requiredIfAvailable: element.attrs["required-if-available"] ?? null,
        }));
}

function moduleSetNames(elements) {
    return elements
        .filter(
            (element) =>
                element.name === "module" &&
                (element.attrs.name || element.attrs.value),
        )
        .map((element) => element.attrs.name ?? element.attrs.value);
}

function resolveResource(reader, roots, resourceName, currentPath = null) {
    const normalized = resourceName.replace(/^\//, "");
    const candidates = new Set();
    const currentRoot = currentPath
        ? [...roots]
              .sort((left, right) => right.length - left.length)
              .find((root) => currentPath.startsWith(`${root}/`))
        : null;
    const relativeToCurrent =
        currentRoot && currentPath
            ? posix.normalize(
                  posix.join(
                      currentRoot,
                      posix.dirname(currentPath.slice(currentRoot.length + 1)),
                      normalized,
                  ),
              )
            : null;
    if (relativeToCurrent && reader.has(relativeToCurrent))
        candidates.add(relativeToCurrent);
    if (currentRoot) {
        const sameRoot = posix.join(currentRoot, normalized);
        if (reader.has(sameRoot)) candidates.add(sameRoot);
    }
    for (const root of roots) {
        const path = posix.join(root, normalized);
        if (reader.has(path)) candidates.add(path);
    }
    if (reader.has(normalized)) candidates.add(normalized);
    return [...candidates].sort(compareText);
}

function mainPluginDescriptor(reader, module, imlPath, resourceRoots) {
    const candidates = resourceRoots
        .map((root) => posix.join(root, "META-INF/plugin.xml"))
        .filter((path) => reader.has(path));
    if (candidates.length !== 1) {
        throw new Error(
            `Bundled plugin ${module} (${imlPath}) has ${candidates.length} main descriptors`,
        );
    }
    return candidates[0];
}

function yamlNameRegistration(reader, path, name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
        `^\\s*-\\s*name:\\s*${escapedName}\\s*(?:#.*)?$`,
        "m",
    ).exec(reader.read(path));
    if (!match) return null;
    return reader.source(
        path,
        lineNumberAt(lineStarts(reader.read(path)), match.index),
    );
}

function pluginContentPathsForRegistrations(reader, registrations) {
    const paths = new Set();
    for (const registration of registrations) {
        let directory = posix.dirname(registration.source?.path ?? "");
        while (directory && directory !== "." && directory !== "/") {
            const candidate = posix.join(directory, "plugin-content.yaml");
            if (reader.has(candidate)) {
                paths.add(candidate);
                break;
            }
            const parent = posix.dirname(directory);
            if (parent === directory) break;
            directory = parent;
        }
    }
    return [...paths].sort(compareText);
}

function classifyNonImlModule(reader, name, imlPaths, registrations) {
    if (imlPaths.length > 1) {
        return {
            name,
            classification: "ambiguous-iml",
            imlPaths,
            registrations,
            evidence: imlPaths.map((path) => reader.source(path)),
        };
    }

    if (
        name.startsWith("com.intellij.modules.") &&
        registrations.some((registration) => registration.kind === "ide-common")
    ) {
        return {
            name,
            classification: "module-set-alias",
            imlPaths,
            registrations,
            evidence: registrations.map((registration) => registration.source),
        };
    }

    const layoutEvidence = pluginContentPathsForRegistrations(
        reader,
        registrations,
    )
        .map((path) => yamlNameRegistration(reader, path, name))
        .filter(Boolean);
    if (layoutEvidence.length > 0) {
        return {
            name,
            classification: "packaging-layout-module",
            imlPaths,
            registrations,
            evidence: layoutEvidence,
        };
    }

    return {
        name,
        classification: "unresolved",
        imlPaths,
        registrations,
        evidence: [],
    };
}

function buildProductClosure(reader) {
    const modulesByName = moduleIndex(reader);
    const defaultPlugins = extractPersistentList(
        reader.read(PRODUCT_LAYOUT_FILES.productModulesLayout),
        "DEFAULT_BUNDLED_PLUGINS",
    );
    const rebasedPlugins = extractPersistentList(
        reader.read(PRODUCT_LAYOUT_FILES.baseIdeaProperties),
        "REBASED_BUNDLED_PLUGINS",
    );
    const bundledPluginNames = [
        ...new Set([...defaultPlugins, ...rebasedPlugins]),
    ].sort(compareText);
    const bundledPlugins = [];
    const activeNames = new Map();
    const addActive = (name, registration) => {
        const registrations = activeNames.get(name) ?? [];
        registrations.push(registration);
        activeNames.set(name, registrations);
    };

    const generatedPath = PRODUCT_LAYOUT_FILES.generatedIdeCommon;
    const generatedElements = scanXml(
        reader.read(generatedPath),
        generatedPath,
    );
    for (const name of moduleSetNames(generatedElements)) {
        addActive(name, {
            kind: "ide-common",
            source: reader.source(generatedPath),
        });
    }
    addActive("intellij.platform.resources", {
        kind: "product-include",
        source: reader.source(PRODUCT_LAYOUT_FILES.rebasedProperties),
    });
    addActive("intellij.idea.community.customization", {
        kind: "product-implementation",
        source: reader.source(PRODUCT_LAYOUT_FILES.rebasedProperties),
    });

    for (const name of bundledPluginNames) {
        const imlPaths = modulesByName.get(name) ?? [];
        if (imlPaths.length !== 1) {
            throw new Error(
                `Bundled plugin module ${name} maps to ${imlPaths.length} IML files`,
            );
        }
        const roots = rootsForModule(reader, imlPaths[0]);
        const descriptor = mainPluginDescriptor(
            reader,
            name,
            imlPaths[0],
            roots.resources,
        );
        const elements = scanXml(reader.read(descriptor), descriptor);
        const contentModules = contentModuleRegistrations(elements);
        addActive(name, {
            kind: "bundled-plugin",
            source: reader.source(descriptor),
        });
        for (const registration of contentModules) {
            addActive(registration.name, {
                kind: "plugin-content",
                loading: registration.loading,
                requiredIfAvailable: registration.requiredIfAvailable,
                plugin: name,
                source: reader.source(descriptor),
            });
        }
        bundledPlugins.push({
            name,
            iml: imlPaths[0],
            descriptor,
            contentModules: stableSort(contentModules, (entry) => entry.name),
        });
    }

    // The generated product module-set lists direct product content. IntelliJ's
    // platform layout also packages non-test module dependencies of that content.
    // Expanding this closure is required to resolve descriptors such as
    // META-INF/IdeCore.xml and META-INF/CodeStyle.xml without globbing unrelated
    // repository modules.
    const rootsCache = new Map();
    const pendingModules = [...activeNames.keys()];
    const visitedModules = new Set();
    while (pendingModules.length > 0) {
        const name = pendingModules.shift();
        if (visitedModules.has(name)) continue;
        visitedModules.add(name);
        const imlPaths = modulesByName.get(name) ?? [];
        if (imlPaths.length !== 1) continue;
        const roots = rootsForModule(reader, imlPaths[0]);
        rootsCache.set(name, roots);
        for (const dependency of roots.dependencies) {
            const existed = activeNames.has(dependency);
            addActive(dependency, {
                kind: "module-dependency",
                module: name,
                source: reader.source(imlPaths[0]),
            });
            if (!existed) pendingModules.push(dependency);
        }
    }

    const activeModules = [];
    const allResourceRoots = new Set(EXTRA_RESOURCE_ROOTS);
    const allSourceRoots = new Set();
    const nonImlModules = [];
    const unresolvedModules = [];
    const descriptorPaths = new Set([
        generatedPath,
        PRODUCT_LAYOUT_FILES.platformLangPlugin,
        PRODUCT_LAYOUT_FILES.communityCustomization,
        ...bundledPlugins.map((plugin) => plugin.descriptor),
    ]);

    for (const [name, registrations] of [...activeNames].sort(
        ([left], [right]) => compareText(left, right),
    )) {
        const imlPaths = modulesByName.get(name) ?? [];
        if (imlPaths.length !== 1) {
            const nonImlModule = classifyNonImlModule(
                reader,
                name,
                imlPaths,
                stableSort(
                    registrations,
                    (entry) => `${entry.kind}:${entry.plugin ?? ""}`,
                ),
            );
            nonImlModules.push(nonImlModule);
            if (
                nonImlModule.classification === "unresolved" ||
                nonImlModule.classification === "ambiguous-iml"
            ) {
                unresolvedModules.push(nonImlModule);
            }
            continue;
        }
        const roots =
            rootsCache.get(name) ?? rootsForModule(reader, imlPaths[0]);
        for (const root of roots.resources) allResourceRoots.add(root);
        for (const root of roots.sources) allSourceRoots.add(root);
        const moduleDescriptors = roots.resources
            .map((root) => posix.join(root, `${name}.xml`))
            .filter((path) => reader.has(path));
        for (const descriptor of moduleDescriptors)
            descriptorPaths.add(descriptor);
        activeModules.push({
            name,
            iml: imlPaths[0],
            resourceRoots: roots.resources,
            sourceRoots: roots.sources,
            descriptors: moduleDescriptors,
            registrations: stableSort(
                registrations,
                (entry) => `${entry.kind}:${entry.plugin ?? ""}`,
            ),
        });
    }

    const resourceRoots = [...allResourceRoots]
        .filter((root) =>
            reader.paths.some((path) => path.startsWith(`${root}/`)),
        )
        .sort(compareText);
    const includeEdges = [];
    const unresolvedIncludes = [];
    const pending = [...descriptorPaths];
    while (pending.length > 0) {
        const descriptor = pending.shift();
        if (!reader.has(descriptor)) {
            unresolvedIncludes.push({
                from: null,
                href: descriptor,
                reason: "missing-seed",
            });
            continue;
        }
        const elements = scanXml(reader.read(descriptor), descriptor);
        for (const element of elements.filter(
            (candidate) => candidate.name === "xi:include",
        )) {
            const href = element.attrs.href;
            if (!href) continue;
            const matches = resolveResource(
                reader,
                resourceRoots,
                href,
                descriptor,
            );
            const edge = {
                from: descriptor,
                line: element.line,
                href,
                resolved: matches,
            };
            includeEdges.push(edge);
            if (matches.length === 0) {
                unresolvedIncludes.push({ ...edge, reason: "not-found" });
            } else {
                for (const match of matches) {
                    if (!descriptorPaths.has(match)) {
                        descriptorPaths.add(match);
                        pending.push(match);
                    }
                }
            }
        }
    }

    return {
        bundledPlugins: stableSort(bundledPlugins, (plugin) => plugin.name),
        activeModules: stableSort(activeModules, (module) => module.name),
        nonImlModules: stableSort(nonImlModules, (module) => module.name),
        unresolvedModules: stableSort(
            unresolvedModules,
            (module) => module.name,
        ),
        resourceRoots,
        sourceRoots: [...allSourceRoots].sort(compareText),
        descriptorPaths: [...descriptorPaths].sort(compareText),
        includeEdges: stableSort(
            includeEdges,
            (edge) => `${edge.from}:${String(edge.line).padStart(6, "0")}`,
        ),
        unresolvedIncludes: stableSort(
            unresolvedIncludes,
            (edge) => `${edge.from ?? ""}:${edge.href}`,
        ),
        layoutSources: Object.values(PRODUCT_LAYOUT_FILES).sort(compareText),
    };
}

function javaProperties(source) {
    const logicalLines = [];
    let current = "";
    for (const physical of source.split(/\r?\n/)) {
        current += physical;
        let slashCount = 0;
        for (
            let index = current.length - 1;
            current[index] === "\\";
            index -= 1
        )
            slashCount += 1;
        if (slashCount % 2 === 1) {
            current = current.slice(0, -1);
            continue;
        }
        logicalLines.push(current);
        current = "";
    }
    if (current) logicalLines.push(current);

    const decode = (value) =>
        value
            .replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
                String.fromCharCode(Number.parseInt(hex, 16)),
            )
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\([:=#! ])/g, "$1")
            .replace(/\\\\/g, "\\");
    const result = {};
    for (const line of logicalLines) {
        const trimmed = line.trimStart();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!"))
            continue;
        let separator = -1;
        let escaped = false;
        for (let index = 0; index < line.length; index += 1) {
            const character = line[index];
            if (
                !escaped &&
                (character === "=" || character === ":" || /\s/.test(character))
            ) {
                separator = index;
                break;
            }
            escaped = !escaped && character === "\\";
            if (character !== "\\") escaped = false;
        }
        const key = separator < 0 ? line : line.slice(0, separator);
        let value = separator < 0 ? "" : line.slice(separator + 1);
        value = value.replace(/^\s*[=:]?\s*/, "");
        result[decode(key.trim())] = decode(value);
    }
    return result;
}

function resolveBundle(reader, closure, bundleName, descriptor) {
    if (!bundleName) return null;
    const resource = `${bundleName.replaceAll(".", "/")}.properties`;
    const matches = resolveResource(
        reader,
        closure.resourceRoots,
        resource,
        descriptor,
    );
    if (matches.length !== 1)
        return { name: bundleName, paths: matches, values: null };
    return {
        name: bundleName,
        paths: matches,
        values: javaProperties(reader.read(matches[0])),
    };
}

function declarationId(element, descriptor) {
    return (
        element.attrs.id ??
        element.attrs.class ??
        `anonymous@${descriptor}:${element.line}`
    );
}

function nearestDeclaration(elements, index) {
    return nearestAncestor(elements, index, new Set(["action", "group"]));
}

function extractActionSystem(reader, closure) {
    const actions = [];
    const groups = [];
    const addToGroups = [];
    const parsedDescriptors = [];

    for (const descriptor of closure.descriptorPaths) {
        const source = reader.read(descriptor);
        const elements = scanXml(source, descriptor);
        const descriptorBundle = descriptorResourceBundle(source);
        parsedDescriptors.push({ descriptor, elements, descriptorBundle });
        const bundleCache = new Map();
        const bundleFor = (name) => {
            if (!name) return null;
            if (!bundleCache.has(name)) {
                bundleCache.set(
                    name,
                    resolveBundle(reader, closure, name, descriptor),
                );
            }
            return bundleCache.get(name);
        };

        for (let index = 0; index < elements.length; index += 1) {
            const element = elements[index];
            const actionsAncestor = nearestAncestor(
                elements,
                index,
                new Set(["actions"]),
            );
            if (
                (element.name === "action" || element.name === "group") &&
                actionsAncestor !== null
            ) {
                const id = declarationId(element, descriptor);
                const parentDeclaration = nearestDeclaration(elements, index);
                const actionsBundle =
                    elements[actionsAncestor].attrs["resource-bundle"] ?? null;
                const bundleName =
                    element.attrs.bundle ?? actionsBundle ?? descriptorBundle;
                const bundle = bundleFor(bundleName);
                const prefix = element.name === "action" ? "action" : "group";
                const labelKey = element.attrs.key ?? `${prefix}.${id}.text`;
                const descriptionKey = `${prefix}.${id}.description`;
                const record = {
                    stableId: `${prefix}:${id}`,
                    id,
                    className: element.attrs.class ?? null,
                    text:
                        element.attrs.text ??
                        bundle?.values?.[labelKey] ??
                        null,
                    description:
                        element.attrs.description ??
                        bundle?.values?.[descriptionKey] ??
                        null,
                    labelKey,
                    bundle: bundle
                        ? {
                              name: bundle.name,
                              paths: bundle.paths,
                              resolved: bundle.values !== null,
                          }
                        : null,
                    icon: element.attrs.icon ?? null,
                    internal: element.attrs.internal === "true",
                    popup: element.attrs.popup === "true",
                    searchable: element.attrs.searchable !== "false",
                    useShortcutOf: element.attrs["use-shortcut-of"] ?? null,
                    parentId:
                        parentDeclaration === null
                            ? null
                            : declarationId(
                                  elements[parentDeclaration],
                                  descriptor,
                              ),
                    attributes: element.attrs,
                    shortcuts: [],
                    children: [],
                    source: reader.source(descriptor, element.line),
                };
                if (element.name === "action") actions.push(record);
                else groups.push(record);
            }

            if (element.name === "add-to-group" && actionsAncestor !== null) {
                const owner = nearestDeclaration(elements, index);
                if (owner === null) continue;
                const ownerElement = elements[owner];
                addToGroups.push({
                    ownerType: ownerElement.name,
                    ownerId: declarationId(ownerElement, descriptor),
                    groupId: element.attrs["group-id"] ?? null,
                    anchor: element.attrs.anchor ?? "last",
                    relativeToAction:
                        element.attrs["relative-to-action"] ?? null,
                    source: reader.source(descriptor, element.line),
                });
            }
        }

        const records = [...actions, ...groups].filter(
            (record) => record.source.path === descriptor,
        );
        const byLocation = new Map(
            records.map((record) => [
                `${record.source.line}:${record.attributes.class ?? ""}:${record.id}`,
                record,
            ]),
        );
        const declarationRecord = (index) => {
            const owner = nearestDeclaration(elements, index);
            if (owner === null) return null;
            const element = elements[owner];
            return (
                byLocation.get(
                    `${element.line}:${element.attrs.class ?? ""}:${declarationId(element, descriptor)}`,
                ) ?? null
            );
        };
        for (let index = 0; index < elements.length; index += 1) {
            const element = elements[index];
            if (
                element.name === "keyboard-shortcut" ||
                element.name === "mouse-shortcut"
            ) {
                const record = declarationRecord(index);
                if (!record) continue;
                record.shortcuts.push({
                    type: element.name,
                    ...element.attrs,
                    source: reader.source(descriptor, element.line),
                });
            }
            if (element.name === "reference" || element.name === "separator") {
                const record = declarationRecord(index);
                if (!record || !record.stableId.startsWith("group:")) continue;
                record.children.push(
                    element.name === "reference"
                        ? {
                              type: "reference",
                              ref: element.attrs.ref ?? null,
                              source: reader.source(descriptor, element.line),
                          }
                        : {
                              type: "separator",
                              source: reader.source(descriptor, element.line),
                          },
                );
            }
        }
    }

    for (const record of [...actions, ...groups]) {
        record.shortcuts = stableSort(
            record.shortcuts,
            (shortcut) =>
                `${shortcut.keymap ?? ""}:${shortcut["first-keystroke"] ?? shortcut.keystroke ?? ""}`,
        );
    }
    return {
        actions: stableSort(
            actions,
            (record) =>
                `${record.stableId}:${record.source.path}:${record.source.line}`,
        ),
        groups: stableSort(
            groups,
            (record) =>
                `${record.stableId}:${record.source.path}:${record.source.line}`,
        ),
        addToGroups: stableSort(
            addToGroups,
            (entry) =>
                `${entry.groupId ?? ""}:${entry.ownerId}:${entry.source.path}:${entry.source.line}`,
        ),
        parsedDescriptors,
    };
}

function keymapActions(elements, sourcePath) {
    const result = [];
    for (let index = 0; index < elements.length; index += 1) {
        const element = elements[index];
        if (element.name !== "action" || !element.attrs.id) continue;
        const shortcuts = [];
        for (let child = 0; child < elements.length; child += 1) {
            const candidate = elements[child];
            if (candidate.parent !== index) continue;
            if (
                ![
                    "keyboard-shortcut",
                    "keyboard-gesture-shortcut",
                    "mouse-shortcut",
                ].includes(candidate.name)
            ) {
                continue;
            }
            shortcuts.push({ type: candidate.name, ...candidate.attrs });
        }
        result.push({
            id: element.attrs.id,
            shortcuts: stableSort(
                shortcuts,
                (shortcut) =>
                    `${shortcut.type}:${shortcut["first-keystroke"] ?? shortcut.keystroke ?? ""}`,
            ),
            source: { path: sourcePath, line: element.line },
        });
    }
    return stableSort(result, (entry) => entry.id);
}

function mergeKeymap(parent, own) {
    const effective = new Map(
        (parent?.actions ?? []).map((entry) => [
            entry.id,
            entry.shortcuts.map((shortcut) => ({ ...shortcut })),
        ]),
    );
    for (const entry of own.actions) {
        let shortcuts = effective.get(entry.id) ?? [];
        if (entry.shortcuts.length === 0) shortcuts = [];
        for (const shortcut of entry.shortcuts) {
            const identity = `${shortcut.type}:${shortcut["first-keystroke"] ?? shortcut.keystroke ?? ""}:${shortcut["second-keystroke"] ?? ""}`;
            if (shortcut["replace-all"] === "true") shortcuts = [];
            if (shortcut.remove === "true") {
                shortcuts = shortcuts.filter(
                    (candidate) =>
                        `${candidate.type}:${candidate["first-keystroke"] ?? candidate.keystroke ?? ""}:${candidate["second-keystroke"] ?? ""}` !==
                        identity,
                );
            } else if (
                !shortcuts.some(
                    (candidate) =>
                        `${candidate.type}:${candidate["first-keystroke"] ?? candidate.keystroke ?? ""}:${candidate["second-keystroke"] ?? ""}` ===
                        identity,
                )
            ) {
                shortcuts.push(shortcut);
            }
        }
        effective.set(entry.id, shortcuts);
    }
    return [...effective]
        .map(([id, shortcuts]) => ({
            id,
            shortcuts: stableSort(shortcuts, (entry) => JSON.stringify(entry)),
        }))
        .sort((left, right) => compareText(left.id, right.id));
}

function extractKeymaps(reader, closure, parsedDescriptors, actions) {
    const registrations = [];
    for (const { descriptor, elements } of parsedDescriptors) {
        for (const element of elements.filter(
            (candidate) => candidate.name === "bundledKeymap",
        )) {
            const file = element.attrs.file;
            const matches = file
                ? resolveResource(
                      reader,
                      closure.resourceRoots,
                      `keymaps/${file}`,
                      descriptor,
                  )
                : [];
            registrations.push({
                file,
                paths: matches,
                source: reader.source(descriptor, element.line),
            });
        }
    }
    const keymaps = [];
    for (const registration of stableSort(
        registrations,
        (entry) => entry.file ?? "",
    )) {
        for (const path of registration.paths) {
            const elements = scanXml(reader.read(path), path);
            const root = elements.find((element) => element.name === "keymap");
            if (!root) continue;
            keymaps.push({
                name: root.attrs.name,
                parent: root.attrs.parent ?? null,
                disableMnemonics: root.attrs["disable-mnemonics"] === "true",
                path,
                blob: reader.source(path).blob,
                actions: keymapActions(elements, path),
            });
        }
    }
    const unique = [
        ...new Map(keymaps.map((keymap) => [keymap.name, keymap])).values(),
    ];
    const byName = new Map(unique.map((keymap) => [keymap.name, keymap]));
    const resolved = new Map();
    const resolveEffective = (name, visiting = new Set()) => {
        if (resolved.has(name)) return resolved.get(name);
        if (visiting.has(name))
            throw new Error(`Cyclic keymap inheritance at ${name}`);
        const keymap = byName.get(name);
        if (!keymap) return null;
        const next = new Set(visiting).add(name);
        const parent = keymap.parent
            ? resolveEffective(keymap.parent, next)
            : null;
        const value = { name, actions: mergeKeymap(parent, keymap) };
        resolved.set(name, value);
        return value;
    };
    const descriptorShortcuts = actions.flatMap((action) =>
        action.shortcuts.map((shortcut) => ({
            actionId: action.id,
            ...shortcut,
        })),
    );
    return {
        registrations,
        keymaps: stableSort(unique, (keymap) => keymap.name),
        effectiveMacOS: resolveEffective("Mac OS X 10.5+"),
        descriptorShortcuts: stableSort(
            descriptorShortcuts,
            (entry) =>
                `${entry.keymap ?? ""}:${entry.actionId}:${entry["first-keystroke"] ?? ""}`,
        ),
    };
}

function extractExtensions(reader, parsedDescriptors) {
    const toolWindows = [];
    const configurables = [];
    for (const { descriptor, elements } of parsedDescriptors) {
        for (const element of elements) {
            if (
                [
                    "toolWindow",
                    "toolWindowExtractorMode",
                    "toolWindowInitializer",
                ].includes(element.name)
            ) {
                toolWindows.push({
                    stableId: `toolwindow:${element.attrs.id ?? element.attrs.toolWindowId ?? element.attrs.implementation ?? `${descriptor}:${element.line}`}`,
                    kind: element.name,
                    attributes: element.attrs,
                    source: reader.source(descriptor, element.line),
                });
            }
            if (
                ["applicationConfigurable", "projectConfigurable"].includes(
                    element.name,
                )
            ) {
                const id =
                    element.attrs.id ??
                    element.attrs.instance ??
                    element.attrs.provider ??
                    `${descriptor}:${element.line}`;
                configurables.push({
                    stableId: `configurable:${id}`,
                    scope:
                        element.name === "applicationConfigurable"
                            ? "application"
                            : "project",
                    attributes: element.attrs,
                    source: reader.source(descriptor, element.line),
                });
            }
        }
    }
    return {
        toolWindows: stableSort(
            toolWindows,
            (entry) =>
                `${entry.stableId}:${entry.source.path}:${entry.source.line}`,
        ),
        configurables: stableSort(
            configurables,
            (entry) =>
                `${entry.stableId}:${entry.source.path}:${entry.source.line}`,
        ),
    };
}

function classPathCandidates(reader, className) {
    const base = className.split(".").at(-1).split("$")[0];
    const packageName = className.split(".").slice(0, -1).join("/");
    const suffixes = [
        `/${packageName}/${base}.kt`,
        `/${packageName}/${base}.java`,
    ];
    const basenameCandidates = reader.paths.filter(
        (path) =>
            path.endsWith(`/${base}.kt`) || path.endsWith(`/${base}.java`),
    );
    const exact = basenameCandidates.filter((path) =>
        suffixes.some((suffix) => path.endsWith(suffix)),
    );
    return (exact.length > 0 ? exact : basenameCandidates).sort(compareText);
}

function inspectDynamicSource(reader, path) {
    const source = reader.read(path);
    const packageName = /^\s*package\s+([\w.]+)/m.exec(source)?.[1] ?? null;
    return {
        packageName,
        getChildren: /\bgetChildren\s*\(/.test(source),
        update: /\bupdate\s*\(/.test(source),
        actionPerformed: /\bactionPerformed\s*\(/.test(source),
        createsActions: /\b(create|build|get)[A-Z]\w*Actions?\s*\(/.test(
            source,
        ),
        source: reader.source(path),
    };
}

function extractDynamicProviders(reader, closure, actionSystem) {
    const registrations = new Map();
    const register = (className, registration) => {
        if (!className || !/[A-Za-z]/.test(className)) return;
        const entries = registrations.get(className) ?? [];
        entries.push(registration);
        registrations.set(className, entries);
    };
    for (const group of actionSystem.groups.filter(
        (entry) => entry.className,
    )) {
        register(group.className, {
            kind: "declared-action-group",
            id: group.id,
            source: group.source,
        });
    }
    for (const { descriptor, elements } of actionSystem.parsedDescriptors) {
        for (const element of elements) {
            for (const [attribute, value] of Object.entries(element.attrs)) {
                if (
                    ![
                        "class",
                        "implementation",
                        "implementationClass",
                        "provider",
                        "factoryClass",
                    ].includes(attribute)
                ) {
                    continue;
                }
                if (
                    !/(ActionGroup|ActionProvider|ActionsProvider|Popup)/.test(
                        value,
                    )
                )
                    continue;
                register(value, {
                    kind: `extension:${element.name}:${attribute}`,
                    source: reader.source(descriptor, element.line),
                });
            }
        }
    }

    const activeRoots = closure.sourceRoots;
    const fileLooksDynamic = (path) =>
        /(ActionGroup|ActionProvider|ActionsProvider|PopupActions|BranchesTreePopup).*(\.kt|\.java)$/.test(
            path,
        );
    for (const path of reader.paths.filter(fileLooksDynamic)) {
        if (!activeRoots.some((root) => path.startsWith(`${root}/`))) continue;
        const inspection = inspectDynamicSource(reader, path);
        const base = posix.basename(path).replace(/\.(kt|java)$/, "");
        const className = inspection.packageName
            ? `${inspection.packageName}.${base}`
            : base;
        if (
            !inspection.getChildren &&
            !inspection.createsActions &&
            !/Provider|Popup/.test(base)
        )
            continue;
        register(className, {
            kind: "source-discovery",
            source: reader.source(path),
        });
    }

    return [...registrations]
        .map(([className, entries]) => {
            const sourcePaths = classPathCandidates(reader, className);
            return {
                stableId: `dynamic-provider:${className}`,
                className,
                registrations: stableSort(
                    entries,
                    (entry) =>
                        `${entry.kind}:${entry.source.path}:${entry.source.line}`,
                ),
                sourceCandidates: sourcePaths.map((path) =>
                    inspectDynamicSource(reader, path),
                ),
            };
        })
        .sort((left, right) => compareText(left.stableId, right.stableId));
}

function leafCount(value) {
    if (!value || typeof value !== "object") return 1;
    return Object.values(value).reduce(
        (total, child) => total + leafCount(child),
        0,
    );
}

function extractThemes(reader, closure, parsedDescriptors) {
    const providers = [];
    const colorSchemes = [];
    for (const { descriptor, elements } of parsedDescriptors) {
        for (const element of elements) {
            if (element.name === "themeProvider" && element.attrs.path) {
                const paths = resolveResource(
                    reader,
                    closure.resourceRoots,
                    element.attrs.path,
                    descriptor,
                );
                providers.push({
                    attributes: element.attrs,
                    paths,
                    source: reader.source(descriptor, element.line),
                });
            }
            if (element.name === "bundledColorScheme" && element.attrs.path) {
                const paths = resolveResource(
                    reader,
                    closure.resourceRoots,
                    element.attrs.path,
                    descriptor,
                );
                colorSchemes.push({
                    attributes: element.attrs,
                    paths,
                    source: reader.source(descriptor, element.line),
                });
            }
        }
    }
    const themes = [];
    for (const provider of stableSort(
        providers,
        (entry) => entry.attributes.id ?? "",
    )) {
        for (const path of provider.paths) {
            const source = reader.read(path);
            const definition = JSON.parse(source);
            themes.push({
                stableId: `theme:${provider.attributes.id ?? definition.name}`,
                id: provider.attributes.id ?? null,
                name: definition.name ?? null,
                targetUi: provider.attributes.targetUi ?? null,
                dark: Boolean(definition.dark),
                author: definition.author ?? null,
                parentTheme: definition.parentTheme ?? null,
                editorScheme: definition.editorScheme ?? null,
                tokenCount: leafCount(definition),
                definition,
                source: { ...reader.source(path), sha256: sha256(source) },
                registration: provider.source,
            });
        }
    }
    return {
        themes: stableSort(themes, (theme) => theme.stableId),
        unresolvedProviders: providers.filter(
            (provider) => provider.paths.length !== 1,
        ),
        colorSchemes: stableSort(
            colorSchemes,
            (scheme) => scheme.attributes.id ?? "",
        ),
    };
}

function parseGeneratedIconClass(source, rootName) {
    const result = new Map();
    const stack = [];
    let depth = 0;
    for (const line of source.split(/\r?\n/)) {
        const classMatch = /public static final class\s+(\w+)/.exec(line);
        if (classMatch) stack.push({ name: classMatch[1], depth: depth + 1 });
        const field =
            /public static final[^\n]*Icon\s+(\w+)\s*=\s*load\(([^;]+)\);/.exec(
                line,
            );
        if (field) {
            const paths = [...field[2].matchAll(/"([^"]+\.(?:svg|png))"/g)].map(
                (match) => match[1],
            );
            result.set(
                [rootName, ...stack.map((entry) => entry.name), field[1]].join(
                    ".",
                ),
                {
                    expUiPath: paths.length > 1 ? paths[0] : (paths[0] ?? null),
                    fallbackPath: paths.length > 1 ? paths[1] : null,
                },
            );
        }
        depth +=
            (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
        while (stack.length > 0 && depth < stack.at(-1).depth) stack.pop();
    }
    return result;
}

function extractIcons(reader, closure, parsedDescriptors, themes) {
    const references = [];
    const addReference = (value, occurrence) => {
        if (typeof value !== "string" || value.length === 0) return;
        references.push({ value, ...occurrence });
    };
    for (const { descriptor, elements } of parsedDescriptors) {
        for (const element of elements) {
            if (!element.attrs.icon) continue;
            addReference(element.attrs.icon, {
                kind: `descriptor:${element.name}`,
                source: reader.source(descriptor, element.line),
            });
        }
    }
    for (const theme of themes.themes) {
        for (const [from, to] of Object.entries(theme.definition.icons ?? {})) {
            if (typeof to !== "string") continue;
            addReference(from, {
                kind: `theme:${theme.name}:from`,
                source: theme.source,
            });
            addReference(to, {
                kind: `theme:${theme.name}:to`,
                source: theme.source,
            });
        }
    }
    const appInfo = reader.read(PRODUCT_LAYOUT_FILES.applicationInfo);
    for (const match of appInfo.matchAll(/\b(?:svg|svg-small)="([^"]+)"/g)) {
        addReference(match[1], {
            kind: "product-brand",
            reusable: false,
            source: reader.source(PRODUCT_LAYOUT_FILES.applicationInfo),
        });
    }

    const generated = new Map();
    for (const [className, path] of Object.entries(ICON_CLASS_FILES)) {
        if (!reader.has(path)) continue;
        for (const [key, value] of parseGeneratedIconClass(
            reader.read(path),
            className,
        )) {
            generated.set(key, {
                ...value,
                generatedClass: reader.source(path),
            });
        }
    }
    const roots = [
        ...new Set([...closure.resourceRoots, ...EXTRA_RESOURCE_ROOTS]),
    ].sort(compareText);
    const occurrencesByReference = new Map();
    for (const { value, ...occurrence } of references) {
        const occurrences = occurrencesByReference.get(value) ?? [];
        occurrences.push(occurrence);
        occurrencesByReference.set(value, occurrences);
    }
    const assets = [...occurrencesByReference.entries()].map(
        ([reference, occurrences]) => {
            const generatedEntry = generated.get(reference);
            const resourceNames = generatedEntry
                ? [
                      generatedEntry.expUiPath,
                      generatedEntry.fallbackPath,
                  ].filter(Boolean)
                : /\.(svg|png)$/.test(reference)
                  ? [reference]
                  : [];
            const resolved = new Map();
            for (const resourceName of resourceNames) {
                for (const path of resolveResource(
                    reader,
                    roots,
                    resourceName,
                )) {
                    const asset = {
                        resourceName,
                        path,
                        blob: reader.source(path).blob,
                    };
                    resolved.set(`${resourceName}:${path}`, asset);
                }
            }
            const sortedOccurrences = stableSort(
                occurrences,
                (occurrence) =>
                    `${occurrence.kind}:${occurrence.source.path}:${occurrence.source.line ?? 0}`,
            );
            return {
                stableId: `icon:${reference}`,
                reference,
                reusable: sortedOccurrences.every(
                    (occurrence) => occurrence.reusable ?? true,
                ),
                generated: generatedEntry ?? null,
                assets: stableSort(
                    [...resolved.values()],
                    (asset) => `${asset.resourceName}:${asset.path}`,
                ),
                occurrences: sortedOccurrences,
            };
        },
    );
    return stableSort(assets, (asset) => asset.stableId);
}

function writeSnapshot(outputDirectory, files) {
    mkdirSync(dirname(outputDirectory), { recursive: true });
    const temporary = `${outputDirectory}.tmp-${process.pid}`;
    const backup = `${outputDirectory}.previous-${process.pid}`;
    rmSync(temporary, { recursive: true, force: true });
    rmSync(backup, { recursive: true, force: true });
    mkdirSync(temporary, { recursive: true });
    try {
        for (const name of OUTPUT_FILES) {
            if (!(name in files))
                throw new Error(`Missing generated output ${name}`);
            writeFileSync(
                join(temporary, name),
                stableJson(files[name]),
                "utf8",
            );
        }
        if (existsSync(outputDirectory)) renameSync(outputDirectory, backup);
        renameSync(temporary, outputDirectory);
        rmSync(backup, { recursive: true, force: true });
    } catch (error) {
        rmSync(temporary, { recursive: true, force: true });
        if (!existsSync(outputDirectory) && existsSync(backup))
            renameSync(backup, outputDirectory);
        throw error;
    }
}

export function extractRebasedSourceOracle({
    workspaceRoot = DEFAULT_WORKSPACE_ROOT,
    rebasedRepository = join(workspaceRoot, "rebased"),
    outputDirectory = join(
        workspaceRoot,
        "apps/git-client/parity/rebased/1.1.8/source",
    ),
    write = true,
} = {}) {
    const reader = new GitTagReader(rebasedRepository, REBASED_BASELINE.tag);
    const baseline = reader.verify();
    const closure = buildProductClosure(reader);
    const actionSystem = extractActionSystem(reader, closure);
    const keymaps = extractKeymaps(
        reader,
        closure,
        actionSystem.parsedDescriptors,
        actionSystem.actions,
    );
    const extensions = extractExtensions(
        reader,
        actionSystem.parsedDescriptors,
    );
    const dynamicProviders = extractDynamicProviders(
        reader,
        closure,
        actionSystem,
    );
    const themes = extractThemes(
        reader,
        closure,
        actionSystem.parsedDescriptors,
    );
    const icons = extractIcons(
        reader,
        closure,
        actionSystem.parsedDescriptors,
        themes,
    );
    const summary = {
        schemaVersion: 1,
        baseline,
        counts: {
            bundledPlugins: closure.bundledPlugins.length,
            activeModules: closure.activeModules.length,
            nonImlModules: closure.nonImlModules.length,
            unresolvedModules: closure.unresolvedModules.length,
            descriptors: closure.descriptorPaths.length,
            unresolvedIncludes: closure.unresolvedIncludes.length,
            actions: actionSystem.actions.length,
            groups: actionSystem.groups.length,
            addToGroups: actionSystem.addToGroups.length,
            keymaps: keymaps.keymaps.length,
            toolWindows: extensions.toolWindows.length,
            configurables: extensions.configurables.length,
            dynamicProviders: dynamicProviders.length,
            themes: themes.themes.length,
            icons: icons.length,
        },
        generatedFiles: OUTPUT_FILES,
    };
    const productClosure = {
        schemaVersion: 1,
        baseline,
        layoutSources: closure.layoutSources,
        bundledPlugins: closure.bundledPlugins,
        activeModules: closure.activeModules,
        nonImlModules: closure.nonImlModules,
        unresolvedModules: closure.unresolvedModules,
        resourceRoots: closure.resourceRoots,
        sourceRoots: closure.sourceRoots,
        descriptors: closure.descriptorPaths,
        includeEdges: closure.includeEdges,
        unresolvedIncludes: closure.unresolvedIncludes,
    };
    const files = {
        "actions.json": {
            schemaVersion: 1,
            baseline,
            actions: actionSystem.actions,
        },
        "add-to-groups.json": {
            schemaVersion: 1,
            baseline,
            placements: actionSystem.addToGroups,
        },
        "configurables.json": {
            schemaVersion: 1,
            baseline,
            configurables: extensions.configurables,
        },
        "dynamic-providers.json": {
            schemaVersion: 1,
            baseline,
            providers: dynamicProviders,
        },
        "groups.json": {
            schemaVersion: 1,
            baseline,
            groups: actionSystem.groups,
        },
        "icons.json": { schemaVersion: 1, baseline, icons },
        "keymaps.json": { schemaVersion: 1, baseline, ...keymaps },
        "product-closure.json": productClosure,
        "summary.json": summary,
        "themes.json": { schemaVersion: 1, baseline, ...themes },
        "tool-windows.json": {
            schemaVersion: 1,
            baseline,
            toolWindows: extensions.toolWindows,
        },
    };
    if (write) writeSnapshot(outputDirectory, files);
    return { files, summary, outputDirectory };
}

function parseArguments(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--workspace-root")
            options.workspaceRoot = resolve(argv[++index]);
        else if (argument === "--rebased-repository")
            options.rebasedRepository = resolve(argv[++index]);
        else if (argument === "--output")
            options.outputDirectory = resolve(argv[++index]);
        else if (argument === "--no-write") options.write = false;
        else throw new Error(`Unknown argument ${argument}`);
    }
    return options;
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
    try {
        const result = extractRebasedSourceOracle(
            parseArguments(process.argv.slice(2)),
        );
        process.stdout.write(`${stableJson(result.summary)}`);
    } catch (error) {
        process.stderr.write(
            `${error instanceof Error ? error.stack : String(error)}\n`,
        );
        process.exitCode = 1;
    }
}
