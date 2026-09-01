#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const [packageName, version, importSpecifier] = process.argv.slice(2);

if (
  packageName === undefined ||
  !/^@jongminchung\/[a-z0-9-]+$/.test(packageName)
)
  throw new Error("Expected an @jongminchung package name");
if (version === undefined || !/^\d+\.\d+\.\d+$/.test(version))
  throw new Error("Expected a semantic package version");
if (
  importSpecifier === undefined ||
  (importSpecifier !== packageName &&
    !importSpecifier.startsWith(`${packageName}/`))
)
  throw new Error("Import specifier must belong to the published package");

const packageVersion = `${packageName}@${version}`;

async function npm(...arguments_: string[]) {
  return execFileAsync("npm", arguments_, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function readPublishedIntegrity(): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const { stdout } = await npm(
        "view",
        packageVersion,
        "dist.integrity",
        "--json",
      );
      const integrity = JSON.parse(stdout);
      if (typeof integrity !== "string" || !integrity.startsWith("sha512-"))
        throw new Error(`Invalid registry integrity: ${stdout.trim()}`);
      return integrity;
    } catch (error) {
      lastError = error;
      if (attempt < 5)
        await new Promise<void>((resolve) =>
          setTimeout(resolve, attempt * 2_000),
        );
    }
  }
  throw lastError;
}

const integrity = await readPublishedIntegrity();
const consumerDirectory = await mkdtemp(join(tmpdir(), "package-consumer-"));

try {
  await writeFile(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  await execFileAsync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", packageVersion],
    {
      cwd: consumerDirectory,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  await execFileAsync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(importSpecifier)})`,
    ],
    { cwd: consumerDirectory, encoding: "utf8" },
  );
} finally {
  await rm(consumerDirectory, { force: true, recursive: true });
}

console.log(`${packageVersion} verified with ${integrity}`);
