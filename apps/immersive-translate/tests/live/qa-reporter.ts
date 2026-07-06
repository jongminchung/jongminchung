import type { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { QA_EVIDENCE_DIR } from "./qa-artifacts";

interface ScenarioResult {
  readonly title: string;
  readonly status: string;
  readonly durationMs: number;
  readonly screenshots: readonly string[];
  readonly artifacts: readonly string[];
  readonly errors: readonly string[];
}

function run(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, [...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function hashFile(filePath: string): string {
  if (!existsSync(filePath)) return "missing";
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").slice(0, 12);
}

function mtimeIso(filePath: string): string {
  try {
    return statSync(filePath).mtime.toISOString();
  } catch {
    return "unknown";
  }
}

function findSpecFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findSpecFiles(entryPath);
    return entry.name.endsWith(".spec.ts") ? [entryPath] : [];
  });
}

function relative(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}

function scenarioTitle(test: TestCase): string {
  return test.title;
}

function attachmentPath(attachment: TestResult["attachments"][number]): string | null {
  if (attachment.name.startsWith("screenshots/")) {
    return path.join(relative(QA_EVIDENCE_DIR), attachment.name);
  }
  return attachment.path ? relative(attachment.path) : null;
}

class QaEvidenceReporter implements Reporter {
  private readonly startedAt = new Date().toISOString();
  private readonly scenarios: ScenarioResult[] = [];
  private readonly runOutput: string[] = [];

  onBegin(_config: FullConfig, _suite: Suite): void {}

  onTestEnd(test: TestCase, result: TestResult): void {
    const artifactPaths = result.attachments
      .map(attachmentPath)
      .filter((pathValue): pathValue is string => !!pathValue);

    this.scenarios.push({
      title: scenarioTitle(test),
      status: result.status,
      durationMs: result.duration,
      screenshots: result.attachments
        .filter((attachment) => attachment.contentType === "image/png" && attachment.path)
        .map(attachmentPath)
        .filter((pathValue): pathValue is string => !!pathValue),
      artifacts: artifactPaths,
      errors: result.errors.map((error) => error.message ?? String(error.value ?? "")),
    });
  }

  onStdOut(chunk: string | Buffer, test?: TestCase): void {
    this.captureOutput("stdout", chunk, test);
  }

  onStdErr(chunk: string | Buffer, test?: TestCase): void {
    this.captureOutput("stderr", chunk, test);
  }

  async onEnd(result: FullResult): Promise<void> {
    await mkdir(QA_EVIDENCE_DIR, { recursive: true });

    const extensionPath = process.env.EXTENSION_PATH ?? ".output/chrome-mv3";
    const manifestPath = path.resolve(process.cwd(), extensionPath, "manifest.json");
    const packageJson = readJson<{ version?: string }>(
      path.resolve(process.cwd(), "package.json"),
      {},
    );
    const manifest = readJson<{ version?: string; name?: string }>(manifestPath, {});
    const specFiles = findSpecFiles(path.resolve(process.cwd(), "tests/live")).map((filePath) => ({
      path: relative(filePath),
      sha256: hashFile(filePath),
    }));
    const metadata = {
      status: result.status,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      gitSha: run("git", ["rev-parse", "HEAD"]),
      branch: run("git", ["branch", "--show-current"]),
      packageVersion: packageJson.version ?? "unknown",
      manifestName: manifest.name ?? "unknown",
      manifestVersion: manifest.version ?? "unknown",
      buildTime: mtimeIso(manifestPath),
      specFiles,
      scenarios: this.scenarios,
    };

    writeFileSync(
      path.join(QA_EVIDENCE_DIR, "metadata.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
    writeFileSync(path.join(QA_EVIDENCE_DIR, "run-output.log"), `${this.runOutput.join("\n")}\n`);
    writeFileSync(path.join(QA_EVIDENCE_DIR, "pr-summary.md"), this.renderSummary(metadata));
  }

  private captureOutput(kind: "stdout" | "stderr", chunk: string | Buffer, test?: TestCase): void {
    const title = test ? scenarioTitle(test) : "run";
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    if (!text.trim()) return;
    this.runOutput.push(`[${kind}] ${title}\n${text.trim()}`);
  }

  private renderSummary(metadata: {
    readonly status: string;
    readonly startedAt: string;
    readonly gitSha: string;
    readonly branch: string;
    readonly packageVersion: string;
    readonly manifestVersion: string;
    readonly buildTime: string;
    readonly specFiles: readonly { readonly path: string; readonly sha256: string }[];
    readonly scenarios: readonly ScenarioResult[];
  }): string {
    const screenshots = Array.from(
      new Set(metadata.scenarios.flatMap((scenario) => scenario.screenshots)),
    );
    const lines = [
      "## Playwright QA Evidence",
      "",
      `- status: ${metadata.status}`,
      `- run: ${metadata.startedAt}`,
      `- git: ${metadata.gitSha.slice(0, 12)} (${metadata.branch})`,
      `- package: ${metadata.packageVersion}`,
      `- extension manifest: ${metadata.manifestVersion} (${metadata.buildTime})`,
      `- specs: ${metadata.specFiles.map((file) => `${file.path}@${file.sha256}`).join(", ")}`,
      "",
      "### Scenarios",
      ...metadata.scenarios.map(
        (scenario) => `- ${scenario.status}: ${scenario.title} (${scenario.durationMs}ms)`,
      ),
      "",
      "### Screenshots",
      ...screenshots.map((screenshot) => `- ${screenshot}`),
      "",
    ];
    return lines.join("\n");
  }
}

export default QaEvidenceReporter;
