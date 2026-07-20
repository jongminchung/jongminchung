import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 4_000;
const MAX_CONSOLE_FAILURES = 5;
const MAX_CONSOLE_MESSAGE_LENGTH = 500;

function truncate(value, limit) {
  if (typeof value !== "string") return null;
  const plainValue = stripVTControlCharacters(value);
  return plainValue.length <= limit ? plainValue : `${plainValue.slice(0, limit - 1)}…`;
}

export function compactTestResult(test, result, rootDirectory = process.cwd()) {
  const error = result.errors.at(0) ?? result.error;
  const titlePath = test.titlePath().filter(Boolean);
  const scopedTitlePath = titlePath[0]?.endsWith(".spec.ts") ? titlePath.slice(1) : titlePath;
  return {
    id: test.id,
    title: scopedTitlePath.join(" › "),
    file: relative(rootDirectory, test.location.file),
    line: test.location.line,
    outcome: test.outcome(),
    durationMs: result.duration,
    message: truncate(error?.message, MAX_MESSAGE_LENGTH),
    stack: truncate(error?.stack, MAX_STACK_LENGTH),
    artifacts: result.attachments.flatMap((attachment) =>
      attachment.path
        ? [
            {
              name: attachment.name,
              contentType: attachment.contentType,
              path: relative(rootDirectory, attachment.path),
            },
          ]
        : [],
    ),
  };
}

export function summarizeResults(results) {
  const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const result of results) {
    if (result.outcome === "expected") counts.passed += 1;
    else if (result.outcome === "unexpected") counts.failed += 1;
    else if (result.outcome === "flaky") counts.flaky += 1;
    else counts.skipped += 1;
  }
  return counts;
}

export function compactFailureLines(failures) {
  return failures.slice(0, MAX_CONSOLE_FAILURES).map((failure) => {
    const firstLine = failure.message?.split("\n", 1)[0] ?? "Unknown failure";
    return `- ${failure.file}:${failure.line} ${failure.title}: ${truncate(firstLine, MAX_CONSOLE_MESSAGE_LENGTH)}`;
  });
}

export default class CompactPlaywrightReporter {
  constructor(options = {}) {
    this.options = options;
    this.results = new Map();
    this.startedAt = Date.now();
  }

  onBegin() {
    this.rootDirectory = process.cwd();
  }

  onTestEnd(test, result) {
    this.results.set(test.id, { result, test });
  }

  async onEnd(run) {
    const rootDirectory = this.rootDirectory ?? process.cwd();
    const results = [...this.results.values()].map(({ result, test }) =>
      compactTestResult(test, result, rootDirectory),
    );
    const counts = summarizeResults(results);
    const suite = this.options.suite ?? "playwright";
    const outputFile = resolve(
      rootDirectory,
      this.options.outputFile ?? `test-results/qa/${suite}.json`,
    );
    const report = {
      schemaVersion: 1,
      suite,
      status: run.status,
      startedAt: new Date(this.startedAt).toISOString(),
      durationMs: Date.now() - this.startedAt,
      counts,
      failures: results.filter((result) => result.outcome === "unexpected"),
      flaky: results.filter((result) => result.outcome === "flaky"),
    };

    await mkdir(dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const summary = `${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${counts.skipped} skipped`;
    console.log(`[qa:${suite}] ${summary}; report=${relative(process.cwd(), outputFile)}`);
    for (const line of compactFailureLines(report.failures)) console.log(line);
  }
}
