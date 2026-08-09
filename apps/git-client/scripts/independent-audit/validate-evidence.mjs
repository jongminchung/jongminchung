import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const manifestName = "SHA256SUMS";
const manifestLinePattern = /^([a-f0-9]{64})  \.\/(.+)$/u;
const requiredAxPaths = new Set([
  "ax/01-welcome.txt",
  "ax/02-open-file-or-project.txt",
  "ax/03-trust-project.txt",
  "ax/04-dirty-workbench-default.txt",
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const checkedInEvidenceRoot = resolve(
  scriptDirectory,
  "../../independent-audit/rebased-1.1.11/evidence",
);

function normalizeRelativePath(path) {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe evidence path: ${path}`);
  }
  return path;
}

async function listEvidenceFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    const relativePath = relative(root, absolutePath).split(sep).join("/");
    const stat = await lstat(absolutePath);
    if (stat.isSymbolicLink())
      throw new Error(`Evidence must not contain symlinks: ${relativePath}`);
    if (stat.isDirectory()) {
      files.push(...(await listEvidenceFiles(root, absolutePath)));
      continue;
    }
    if (!stat.isFile()) throw new Error(`Unsupported evidence entry: ${relativePath}`);
    if (relativePath !== manifestName) files.push(relativePath);
  }

  return files.toSorted((left, right) => left.localeCompare(right));
}

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function parseManifest(contents) {
  const lines = contents.split(/\r?\n/u).filter((line) => line.length > 0);
  if (lines.length === 0) throw new Error("Evidence manifest is empty");

  const entries = new Map();
  for (const line of lines) {
    const match = manifestLinePattern.exec(line);
    if (!match) throw new Error(`Invalid SHA256SUMS line: ${line}`);
    const [, digest, rawPath] = match;
    const path = normalizeRelativePath(rawPath);
    if (path === manifestName) throw new Error("SHA256SUMS must not hash itself");
    if (entries.has(path)) throw new Error(`Duplicate evidence manifest entry: ${path}`);
    entries.set(path, digest);
  }
  return entries;
}

function assertSamePaths(actual, expected) {
  const actualPaths = [...actual].toSorted((left, right) => left.localeCompare(right));
  const expectedPaths = [...expected].toSorted((left, right) => left.localeCompare(right));
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    const missing = expectedPaths.filter((path) => !actualPaths.includes(path));
    const extra = actualPaths.filter((path) => !expectedPaths.includes(path));
    throw new Error(
      `Evidence manifest coverage mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
}

function assertMetadata(metadata, manifestPaths) {
  if (metadata?.application?.name !== "Rebased" || metadata.application.version !== "1.1.11") {
    throw new Error("Evidence metadata must identify Rebased 1.1.11");
  }
  if (metadata?.environment?.architecture !== "arm64") {
    throw new Error("Evidence metadata must identify the arm64 environment");
  }

  const screenshotPaths = [
    metadata?.welcome?.screenshot,
    metadata?.trustProject?.screenshot,
    metadata?.dirtyWorkbench?.screenshot,
  ].map((path) => normalizeRelativePath(path ?? ""));
  for (const path of screenshotPaths) {
    if (!path.startsWith("screenshots/") || !manifestPaths.has(path)) {
      throw new Error(`Metadata references an invalid screenshot: ${path}`);
    }
  }

  const manifestedScreenshots = new Set(
    [...manifestPaths].filter((path) => path.startsWith("screenshots/")),
  );
  assertSamePaths(new Set(screenshotPaths), manifestedScreenshots);

  const manifestedAxPaths = new Set([...manifestPaths].filter((path) => path.startsWith("ax/")));
  assertSamePaths(manifestedAxPaths, requiredAxPaths);
}

export async function validateEvidenceBundle(root = checkedInEvidenceRoot) {
  const manifest = parseManifest(await readFile(resolve(root, manifestName), "utf8"));
  const files = await listEvidenceFiles(root);
  assertSamePaths(new Set(manifest.keys()), new Set(files));

  for (const [path, expectedDigest] of manifest) {
    const actualDigest = await sha256(resolve(root, path));
    if (actualDigest !== expectedDigest) {
      throw new Error(`SHA-256 mismatch for evidence file: ${path}`);
    }
  }

  const metadata = JSON.parse(await readFile(resolve(root, "evidence.json"), "utf8"));
  assertMetadata(metadata, new Set(manifest.keys()));

  return { files: files.length, applicationVersion: metadata.application.version };
}
