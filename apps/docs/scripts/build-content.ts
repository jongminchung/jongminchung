import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import ts from "typescript";
import {
  createDocHref,
  locales,
  parseDocMetadata,
  type ContentManifestEntry,
  type DocMetadata,
  type Locale,
  type OutlineEntry,
  type SearchDocument,
} from "../lib/content-model.ts";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(appRoot, "../..");
const contentRoot = resolve(appRoot, "content");
const manifestPath = resolve(appRoot, "generated/content-manifest.json");
const searchRoot = resolve(appRoot, "public/search");

interface SourceDocument {
  readonly metadata: DocMetadata;
  readonly body: string;
  readonly filePath: string;
  readonly outline: readonly OutlineEntry[];
}

interface PackageManifest {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly exports?: unknown;
}

function toPosixPath(value: string): string {
  return value.split(sep).join("/");
}

async function listFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const entryPath = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return files
    .flat()
    .filter((filePath) => extname(filePath) === ".mdx")
    .sort();
}

function slugify(value: string, used: Map<string, number>): string {
  const base = value
    .toLocaleLowerCase()
    .replace(/<[^>]+>/gu, "")
    .replace(/[`*_~[\]().,:!?/\\]/gu, "")
    .trim()
    .replace(/\s+/gu, "-");
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/<[^>]+>/gu, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[`*_~]/gu, "")
    .trim();
}

function createOutline(body: string): readonly OutlineEntry[] {
  const used = new Map<string, number>();
  return body.split("\n").flatMap((line): readonly OutlineEntry[] => {
    const match = /^(#{2,3})\s+(.+)$/u.exec(line);
    if (!match) return [];
    const hashes = match[1];
    const heading = match[2];
    if (hashes === undefined || heading === undefined) return [];
    const label = cleanInlineMarkdown(heading);
    return [{ id: slugify(label, used), label, level: hashes.length as 2 | 3 }];
  });
}

function createSearchBody(body: string): string {
  return body
    .replace(/^---[\s\S]*?---/u, "")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#>*_`~\u005b\u005d()|]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

async function readDocuments(): Promise<readonly SourceDocument[]> {
  const files = await listFiles(contentRoot);
  return Promise.all(
    files.map(async (filePath): Promise<SourceDocument> => {
      const source = await readFile(filePath, "utf8");
      const parsed = matter(source);
      const relativePath = toPosixPath(relative(contentRoot, filePath));
      const metadata = parseDocMetadata(parsed.data, relativePath);
      const expectedPath = `${metadata.locale}/${metadata.id}.mdx`;
      if (relativePath !== expectedPath) {
        throw new Error(`${relativePath}: expected path ${expectedPath} from metadata.`);
      }
      return Object.freeze({
        metadata,
        body: parsed.content,
        filePath,
        outline: createOutline(parsed.content),
      });
    }),
  );
}

function validateDocuments(documents: readonly SourceDocument[]): void {
  const byPair = new Map<string, Set<Locale>>();
  const hrefs = new Set<string>();
  const orders = new Set<string>();

  for (const document of documents) {
    const { metadata } = document;
    const href = createDocHref(metadata.locale, metadata.id);
    if (hrefs.has(href)) throw new Error(`Duplicate document URL: ${href}`);
    hrefs.add(href);

    const orderKey = `${metadata.locale}:${metadata.section}:${metadata.order}`;
    if (orders.has(orderKey)) throw new Error(`Duplicate navigation order: ${orderKey}`);
    orders.add(orderKey);

    const pair = byPair.get(metadata.id) ?? new Set<Locale>();
    pair.add(metadata.locale);
    byPair.set(metadata.id, pair);
  }

  for (const [id, pair] of byPair) {
    const missing = locales.filter((locale) => !pair.has(locale));
    if (missing.length > 0)
      throw new Error(`Document ${id} is missing locales: ${missing.join(", ")}`);
  }

  const knownPaths = new Set(
    documents.map(({ metadata }) => createDocHref(metadata.locale, metadata.id)),
  );
  for (const document of documents) {
    const internalLinks = document.body.matchAll(/\]\((\/(?:ko|en)\/[^)#?\s]+)(?:#[^)]*)?\)/gu);
    for (const match of internalLinks) {
      const href = match[1];
      if (href !== undefined && !knownPaths.has(href)) {
        throw new Error(
          `${relative(workspaceRoot, document.filePath)}: broken internal link ${href}`,
        );
      }
    }
  }
}

function resolveExportTarget(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = resolveExportTarget(item);
      if (target !== null) return target;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Readonly<Record<string, unknown>>;
  for (const condition of ["source", "types", "import", "default"]) {
    const target = resolveExportTarget(record[condition]);
    if (target !== null) return target;
  }
  return null;
}

function createSpecifier(packageName: string, subpath: string): string {
  return subpath === "." ? packageName : `${packageName}/${subpath.replace(/^\.\//u, "")}`;
}

async function readPackageApi(packageDirectory: string): Promise<readonly string[]> {
  const packageRoot = resolve(workspaceRoot, "packages", packageDirectory);
  const manifest = JSON.parse(
    await readFile(resolve(packageRoot, "package.json"), "utf8"),
  ) as PackageManifest;
  if (
    typeof manifest.name !== "string" ||
    typeof manifest.exports !== "object" ||
    !manifest.exports
  ) {
    throw new Error(`${packageDirectory}: invalid package manifest.`);
  }
  const packageName = manifest.name;

  const entries = Object.entries(manifest.exports as Readonly<Record<string, unknown>>).flatMap(
    ([subpath, value]) => {
      const target = resolveExportTarget(value);
      if (target === null || !/\.[cm]?[jt]sx?$/u.test(target)) return [];
      return [
        {
          specifier: createSpecifier(packageName, subpath),
          filePath: resolve(packageRoot, target),
        },
      ];
    },
  );
  const configPath = resolve(workspaceRoot, "tsconfig.json");
  const configFile = ts.readConfigFile(configPath, (fileName) => ts.sys.readFile(fileName));
  if (configFile.error !== undefined) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, workspaceRoot);
  const program = ts.createProgram({
    rootNames: [...new Set([...parsedConfig.fileNames, ...entries.map((entry) => entry.filePath)])],
    options: parsedConfig.options,
  });
  const checker = program.getTypeChecker();

  return entries
    .flatMap((entry) => {
      const sourceFile = program.getSourceFile(entry.filePath);
      const moduleSymbol =
        sourceFile === undefined ? undefined : checker.getSymbolAtLocation(sourceFile);
      if (moduleSymbol === undefined) {
        throw new Error(`Cannot inspect public API at ${entry.filePath}.`);
      }
      return checker
        .getExportsOfModule(moduleSymbol)
        .map((symbol) => `${entry.specifier}#${symbol.name}`);
    })
    .sort();
}

async function validatePackageApi(documents: readonly SourceDocument[]): Promise<void> {
  for (const packageDirectory of ["remark-plantuml", "tooling"] as const) {
    const packageName = `@jongminchung/${packageDirectory}`;
    const documented = new Set(
      documents
        .filter(({ metadata }) => metadata.packageName === packageName)
        .flatMap(({ metadata }) => metadata.apiSymbols ?? []),
    );
    const actual = new Set(await readPackageApi(packageDirectory));
    const missing = [...actual].filter((symbol) => !documented.has(symbol));
    const stale = [...documented].filter((symbol) => !actual.has(symbol));
    if (missing.length > 0 || stale.length > 0) {
      throw new Error(
        [
          `${packageName} API documentation is out of sync.`,
          missing.length === 0 ? "" : `Missing: ${missing.join(", ")}`,
          stale.length === 0 ? "" : `Stale: ${stale.join(", ")}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }
}

async function writeGeneratedFiles(documents: readonly SourceDocument[]): Promise<void> {
  const manifest: readonly ContentManifestEntry[] = documents
    .map(({ metadata, outline }) => ({
      ...metadata,
      href: createDocHref(metadata.locale, metadata.id),
      outline,
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale) || left.order - right.order);

  await mkdir(dirname(manifestPath), { recursive: true });
  await mkdir(searchRoot, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await Promise.all(
    locales.map(async (locale) => {
      const searchDocuments: readonly SearchDocument[] = documents
        .filter(({ metadata }) => metadata.locale === locale)
        .map(({ metadata, body, outline }) => ({
          id: metadata.id,
          locale: metadata.locale,
          section: metadata.section,
          title: metadata.title,
          description: metadata.description,
          href: createDocHref(metadata.locale, metadata.id),
          headings: outline.map((item) => item.label),
          tags: metadata.tags,
          apiSymbols: metadata.apiSymbols ?? [],
          body: createSearchBody(body),
          order: metadata.order,
        }));
      await writeFile(
        resolve(searchRoot, `${locale}.json`),
        `${JSON.stringify(searchDocuments, null, 2)}\n`,
        "utf8",
      );
    }),
  );
}

async function main(): Promise<void> {
  const documents = await readDocuments();
  validateDocuments(documents);
  await validatePackageApi(documents);
  await writeGeneratedFiles(documents);
  process.stdout.write(`Validated ${documents.length} localized documents.\n`);
}

await main();
