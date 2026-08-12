import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const summaryPath = resolve(workspaceRoot, "coverage/coverage-summary.json");
const baselinePath = resolve(workspaceRoot, "coverage-baseline.json");
const updateBaseline = process.argv.includes("--write");

const groups = {
    "engineering-docs": ["apps/engineering-docs/lib/"],
    "git-client-application": ["apps/git-client/src/application/"],
    "git-client-domain": ["apps/git-client/src/domain/"],
    readme: ["apps/readme/app/home-content.ts"],
    tooling: ["packages/tooling/src/"],
    ui: ["packages/ui/src/"],
};
const metricNames = ["branches", "functions", "lines", "statements"];

function workspacePath(filePath) {
    return relative(workspaceRoot, filePath).split(sep).join("/");
}

function percentage(covered, total) {
    if (total === 0) return 100;
    return Math.floor((covered / total) * 10_000) / 100;
}

function aggregate(entries) {
    return Object.fromEntries(
        metricNames.map((metric) => {
            const counts = entries.reduce(
                (result, entry) => ({
                    covered: result.covered + entry[metric].covered,
                    total: result.total + entry[metric].total,
                }),
                { covered: 0, total: 0 },
            );
            return [metric, percentage(counts.covered, counts.total)];
        }),
    );
}

function assertExecutableGroup(name, entries) {
    const executableLines = entries.reduce(
        (total, entry) => total + entry.lines.total,
        0,
    );
    if (executableLines === 0) {
        throw new Error(
            `${name}: coverage sources contain no executable lines`,
        );
    }
}

const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const files = Object.entries(summary)
    .filter(([filePath]) => filePath !== "total")
    .map(([filePath, metrics]) => ({
        filePath: workspacePath(filePath),
        metrics,
    }));
const current = Object.fromEntries(
    Object.entries(groups).map(([name, prefixes]) => {
        const entries = files
            .filter(({ filePath }) =>
                prefixes.some((prefix) => filePath.startsWith(prefix)),
            )
            .map(({ metrics }) => metrics);
        if (entries.length === 0) {
            throw new Error(`${name}: no coverage source files were found`);
        }
        assertExecutableGroup(name, entries);
        return [name, aggregate(entries)];
    }),
);

if (updateBaseline) {
    await writeFile(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    process.stdout.write(`Updated ${workspacePath(baselinePath)}\n`);
    process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
const failures = [];
for (const [group, expected] of Object.entries(baseline)) {
    const actual = current[group];
    if (actual === undefined) {
        failures.push(`${group}: no covered source files were found`);
        continue;
    }
    for (const metric of metricNames) {
        if (actual[metric] < expected[metric]) {
            failures.push(
                `${group}.${metric}: ${actual[metric]} is below ${expected[metric]}`,
            );
        }
    }
}
for (const group of Object.keys(current)) {
    if (baseline[group] === undefined)
        failures.push(`${group}: missing from coverage-baseline.json`);
}

if (failures.length > 0) {
    throw new Error(`Coverage baseline regressed:\n${failures.join("\n")}`);
}

process.stdout.write("Coverage baseline satisfied\n");
