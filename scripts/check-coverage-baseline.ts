import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const summaryPath = resolve(workspaceRoot, "coverage/coverage-summary.json");
const baselinePath = resolve(workspaceRoot, "coverage-baseline.json");
const updateBaseline = process.argv.includes("--write");

const groups = {
    web: ["apps/web/lib/"],
    "git-client-application": ["apps/git-client/src/application/"],
    "git-client-domain": ["apps/git-client/src/domain/"],
    tooling: ["packages/tooling/src/"],
    ui: ["packages/ui/src/"],
} as const;
const metricNames = ["branches", "functions", "lines", "statements"] as const;

type MetricName = (typeof metricNames)[number];
interface CoverageMetric {
    readonly covered: number;
    readonly total: number;
}
type CoverageMetrics = Readonly<Record<MetricName, CoverageMetric>>;
type CoveragePercentages = Readonly<Record<MetricName, number>>;

function workspacePath(filePath: string): string {
    return relative(workspaceRoot, filePath).split(sep).join("/");
}

function percentage(covered: number, total: number): number {
    if (total === 0) return 100;
    return Math.floor((covered / total) * 10_000) / 100;
}

function aggregate(entries: readonly CoverageMetrics[]): CoveragePercentages {
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
    ) as CoveragePercentages;
}

function assertExecutableGroup(
    name: string,
    entries: readonly CoverageMetrics[],
): void {
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

const summary = JSON.parse(await readFile(summaryPath, "utf8")) as Readonly<
    Record<string, CoverageMetrics>
>;
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
) as Readonly<Record<string, CoveragePercentages>>;

if (updateBaseline) {
    await writeFile(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    process.stdout.write(`Updated ${workspacePath(baselinePath)}\n`);
    process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as Readonly<
    Record<string, CoveragePercentages>
>;
const failures: string[] = [];
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
