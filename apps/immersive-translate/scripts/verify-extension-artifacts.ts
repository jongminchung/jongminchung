#!/usr/bin/env node

import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface ExtensionApp {
  readonly id: string;
  readonly dir: string;
  readonly expectedName: string;
  readonly requiredFiles: readonly string[];
  readonly forbiddenFiles: readonly string[];
}

type JsonObject = Record<string, unknown>;

const apps: readonly ExtensionApp[] = [
  {
    id: "immersive-translate",
    dir: ".",
    expectedName: "Tobi Immersive Translate",
    requiredFiles: [
      "manifest.json",
      "background.js",
      "popup.html",
      "icon/16.png",
      "icon/32.png",
      "icon/48.png",
      "icon/96.png",
      "icon/128.png",
    ],
    forbiddenFiles: ["wxt.svg"],
  },
];

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function asObject(value: unknown, file: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${file} must contain a JSON object.`);
  }

  return value as JsonObject;
}

async function readJsonObject(file: string): Promise<JsonObject> {
  return asObject(JSON.parse(await readFile(file, "utf8")) as unknown, file);
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function listZipFiles(app: ExtensionApp): Promise<readonly string[]> {
  const outputDir = `${app.dir}/.output`;
  let entries: Dirent[];
  try {
    entries = await readdir(outputDir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
    .map((entry) => join(outputDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function listZipEntries(zipFile: string): Promise<readonly string[]> {
  try {
    const { stdout } = await execFileAsync("unzip", ["-Z1", zipFile]);
    return String(stdout)
      .split("\n")
      .filter((entry) => entry.length > 0);
  } catch (error) {
    const stderrValue =
      typeof error === "object" && error !== null && "stderr" in error ? error.stderr : "";
    const stderr = String(stderrValue).trim();
    throw new Error(`Unable to inspect ${zipFile}${stderr ? `: ${stderr}` : "."}`);
  }
}

async function verifyBuildDirectory(app: ExtensionApp): Promise<readonly string[]> {
  const failures: string[] = [];
  const packageJson = await readJsonObject(`${app.dir}/package.json`);
  const expectedVersion = readString(packageJson.version);
  if (!expectedVersion) failures.push(`${app.dir}/package.json must declare a string version.`);

  const outputDir = `${app.dir}/.output/chrome-mv3`;
  const manifestPath = `${outputDir}/manifest.json`;
  if (!(await fileExists(manifestPath))) {
    return [`${manifestPath} is missing. Run the app build or zip command first.`];
  }

  const manifest = await readJsonObject(manifestPath);
  if (readNumber(manifest.manifest_version) !== 3) {
    failures.push(`${manifestPath} must be Manifest V3.`);
  }
  if (readString(manifest.name) !== app.expectedName) {
    failures.push(`${manifestPath} has unexpected name: ${String(manifest.name)}`);
  }
  if (expectedVersion && readString(manifest.version) !== expectedVersion) {
    failures.push(
      `${manifestPath} version ${String(manifest.version)} does not match ${app.dir}/package.json ${expectedVersion}.`,
    );
  }

  for (const file of app.requiredFiles) {
    const path = `${outputDir}/${file}`;
    if (!(await fileExists(path))) failures.push(`${path} is missing.`);
  }

  for (const file of app.forbiddenFiles) {
    const path = `${outputDir}/${file}`;
    if (await fileExists(path)) failures.push(`${path} must not be included.`);
  }

  return failures;
}

async function verifyZipFiles(app: ExtensionApp, requireZips: boolean): Promise<readonly string[]> {
  const failures: string[] = [];
  const zipFiles = await listZipFiles(app);

  if (zipFiles.length === 0) {
    if (requireZips) failures.push(`${app.dir}/.output has no zip files.`);
    return failures;
  }

  for (const zipFile of zipFiles) {
    const entries = await listZipEntries(zipFile);
    for (const file of app.requiredFiles) {
      if (!entries.includes(file)) failures.push(`${zipFile} is missing ${file}.`);
    }
    for (const file of app.forbiddenFiles) {
      if (entries.includes(file)) failures.push(`${zipFile} must not include ${file}.`);
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const requireZips = hasFlag("--require-zips");
  const failures: string[] = [];

  for (const app of apps) {
    failures.push(...(await verifyBuildDirectory(app)));
    failures.push(...(await verifyZipFiles(app, requireZips)));
  }

  if (failures.length > 0) {
    console.error("Extension artifact verification failed.");
    console.error(failures.join("\n"));
    process.exit(1);
  }

  console.log("Extension artifacts OK.");
}

await main();

export {};
