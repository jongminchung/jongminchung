#!/usr/bin/env bun

import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const SKILL_PATH = ".agents/skills/generate-article-image";
const REFERENCE_PATH = `${SKILL_PATH}/references/image-examples/openai-developer-blog`;
const TARGET_WIDTH = 1536;
const TARGET_HEIGHT = 1024;
const TARGET_ASPECT_RATIO = TARGET_WIDTH / TARGET_HEIGHT;
const SUPPORTED_REFERENCE_EXTENSIONS = new Set([".png", ".webp"]);
const REFERENCE_ROLES = [
  "composition",
  "palette",
  "material",
  "contrast",
  "motion",
] as const;
const REQUIRED_REFERENCE_ROLES = [
  "composition",
  "palette",
  "material",
] as const;
const ANALYSIS_WIDTH = 192;
const ANALYSIS_HEIGHT = 128;
const EDGE_FRACTION = 0.1;
const DARK_LUMINANCE = 0.06;

type ArticleKind = "investment" | "tech";
type ReferenceRole = (typeof REFERENCE_ROLES)[number];

type ReferenceSelection = {
  filename: string;
  path: string;
  role: ReferenceRole;
};

type ImageMetrics = {
  darkPixelRatio: number;
  edgeMeanLuminance: number;
  meanLuminance: number;
  meanSaturation: number;
  p10Luminance: number;
  p50Luminance: number;
};

type StyleCheck = {
  actual: number;
  id:
    | "dark-pixel-ratio"
    | "edge-luminance"
    | "mean-luminance"
    | "mean-saturation"
    | "p10-luminance";
  limit: number;
  passed: boolean;
  rule: "maximum" | "minimum";
};

type StyleAnalysis = {
  candidate: {
    metrics: ImageMetrics;
    path: string;
  };
  checks: StyleCheck[];
  ok: boolean;
  references: Array<ReferenceSelection & { metrics: ImageMetrics }>;
};

type ArticleContext = {
  article: {
    id: string;
    kind: ArticleKind;
    requestedPath: string;
    sourcePaths: string[];
  };
  generation: {
    colorSpace: "srgb";
    format: "png";
    height: number;
    width: number;
  };
  output: {
    absolutePath: string;
    currentImageExists: boolean;
    repositoryPath: string;
  };
  references: {
    availablePaths: string[];
    directory: string;
    readmePath: string;
    selected: ReferenceSelection[];
    selectedPaths: string[];
  };
  repositoryRoot: string;
  schemaVersion: 2;
};

function fail(message: string): never {
  throw new Error(message);
}

function isReferenceRole(value: string): value is ReferenceRole {
  return REFERENCE_ROLES.some((role) => role === value);
}

export function parseReferenceArguments(
  arguments_: string[],
): Array<{ filename: string; role: ReferenceRole }> {
  if (arguments_.length === 0) return [];
  if (arguments_.length < 3 || arguments_.length > 5) {
    return fail("Select three to five role-labeled reference images");
  }

  const parsed = arguments_.map((argument) => {
    const separator = argument.indexOf("=");
    if (separator <= 0 || separator === argument.length - 1) {
      return fail(
        `Invalid reference ${argument}. Use --reference <role>=<filename>`,
      );
    }

    const role = argument.slice(0, separator);
    const filename = argument.slice(separator + 1);
    if (!isReferenceRole(role)) {
      return fail(
        `Unknown reference role ${role}. Expected one of ${REFERENCE_ROLES.join(", ")}`,
      );
    }
    if (filename.includes("/") || filename.includes("\\")) {
      return fail(`Reference must be a filename, received ${filename}`);
    }
    return { filename, role };
  });

  const roles = parsed.map(({ role }) => role);
  if (new Set(roles).size !== roles.length) {
    return fail("Each reference role can be assigned only once");
  }
  const filenames = parsed.map(({ filename }) => filename);
  if (new Set(filenames).size !== filenames.length) {
    return fail("Assign a distinct image to each reference role");
  }
  for (const role of REQUIRED_REFERENCE_ROLES) {
    if (!roles.includes(role)) {
      return fail(`Missing required reference role: ${role}`);
    }
  }

  return parsed;
}

function toRepositoryPath(repositoryRoot: string, path: string): string {
  return relative(repositoryRoot, path).split(sep).join("/");
}

function isInside(root: string, path: string): boolean {
  const relativePath = relative(root, path);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function findRepositoryRoot(start: string): string {
  let candidate = resolve(start);

  while (true) {
    if (
      existsSync(join(candidate, "apps/web/content")) &&
      existsSync(join(candidate, SKILL_PATH, "SKILL.md"))
    ) {
      return candidate;
    }

    const parent = dirname(candidate);
    if (parent === candidate) {
      return fail(
        `Repository root not found from ${start}. Run this command inside the jongminchung repository`,
      );
    }
    candidate = parent;
  }
}

function readFrontmatterValue(source: string, key: string): string | undefined {
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return undefined;

  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return undefined;

  const line = normalized
    .slice(4, end)
    .split("\n")
    .find((candidate) => candidate.startsWith(`${key}:`));
  if (line === undefined) return undefined;

  const value = line.slice(key.length + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseArticlePath(repositoryPath: string): {
  id: string;
  kind: ArticleKind;
} {
  const techMatch = repositoryPath.match(
    /^apps\/web\/content\/tech\/blog\/(?:en|ko)\/([^/]+)\.mdx$/,
  );
  if (techMatch !== null) {
    const id =
      techMatch[1] ?? fail(`Cannot derive tech article ID: ${repositoryPath}`);
    return {
      id,
      kind: "tech",
    };
  }

  const investmentMatch = repositoryPath.match(
    /^apps\/web\/content\/invest\/(?:en|ko)\/notes\/([^/]+)\.mdx$/,
  );
  if (investmentMatch !== null) {
    const id =
      investmentMatch[1] ??
      fail(`Cannot derive investment article ID: ${repositoryPath}`);
    return {
      id,
      kind: "investment",
    };
  }

  return fail(
    `Unsupported article path: ${repositoryPath}. Pass one tech blog or investment note MDX file`,
  );
}

export async function resolveArticleContext(
  articleArgument: string,
  referenceArguments: string[],
  repositoryRootArgument?: string,
): Promise<ArticleContext> {
  const repositoryRoot = await realpath(
    repositoryRootArgument === undefined
      ? findRepositoryRoot(process.cwd())
      : resolve(repositoryRootArgument),
  );
  const requestedPath = await realpath(
    isAbsolute(articleArgument)
      ? articleArgument
      : resolve(repositoryRoot, articleArgument),
  );

  if (!isInside(repositoryRoot, requestedPath)) {
    return fail(`Article path escapes the repository: ${requestedPath}`);
  }

  const requestedRepositoryPath = toRepositoryPath(
    repositoryRoot,
    requestedPath,
  );
  const article = parseArticlePath(requestedRepositoryPath);
  const locales = ["en", "ko"] as const;
  const sourcePaths = locales.map((locale) =>
    article.kind === "tech"
      ? join(
          repositoryRoot,
          `apps/web/content/tech/blog/${locale}/${article.id}.mdx`,
        )
      : join(
          repositoryRoot,
          `apps/web/content/invest/${locale}/notes/${article.id}.mdx`,
        ),
  );

  for (const sourcePath of sourcePaths) {
    if (!existsSync(sourcePath)) {
      return fail(`Locale counterpart not found: ${sourcePath}`);
    }
  }

  let outputRepositoryPath: string;
  if (article.kind === "tech") {
    outputRepositoryPath = `apps/web/public/tech/articles/${article.id}.png`;
  } else {
    const imageValues = await Promise.all(
      sourcePaths.map(async (sourcePath) =>
        readFrontmatterValue(await readFile(sourcePath, "utf8"), "image"),
      ),
    );
    if (imageValues.some((value) => value === undefined)) {
      return fail(
        "Both investment locale files must declare image frontmatter",
      );
    }
    if (imageValues[0] !== imageValues[1]) {
      return fail(
        "Investment locale files must use the same canonical image path",
      );
    }

    const imagePath = imageValues[0] as string;
    if (!/^\/invest\/[a-z0-9][a-z0-9-]*\.png$/.test(imagePath)) {
      return fail(`Unsupported investment image path: ${imagePath}`);
    }
    outputRepositoryPath = `apps/web/public${imagePath}`;
  }

  const referenceDirectory = join(repositoryRoot, REFERENCE_PATH);
  const referenceEntries = await readdir(referenceDirectory, {
    withFileTypes: true,
  });
  const availablePaths = referenceEntries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const extension = entry.name.slice(entry.name.lastIndexOf("."));
      return SUPPORTED_REFERENCE_EXTENSIONS.has(extension);
    })
    .map((entry) => join(referenceDirectory, entry.name))
    .sort();

  if (availablePaths.length === 0) {
    return fail(`No reference images found in ${referenceDirectory}`);
  }

  const availableByName = new Map(
    availablePaths.map((path) => [path.slice(path.lastIndexOf(sep) + 1), path]),
  );
  const selected = parseReferenceArguments(referenceArguments).map(
    ({ filename, role }) => ({
      filename,
      path:
        availableByName.get(filename) ??
        fail(`Unknown reference image: ${filename}`),
      role,
    }),
  );

  const outputPath = resolve(repositoryRoot, outputRepositoryPath);
  if (!isInside(join(repositoryRoot, "apps/web/public"), outputPath)) {
    return fail(`Output path escapes apps/web/public: ${outputPath}`);
  }

  return {
    article: {
      id: article.id,
      kind: article.kind,
      requestedPath: requestedRepositoryPath,
      sourcePaths: sourcePaths.map((path) =>
        toRepositoryPath(repositoryRoot, path),
      ),
    },
    generation: {
      colorSpace: "srgb",
      format: "png",
      height: TARGET_HEIGHT,
      width: TARGET_WIDTH,
    },
    output: {
      absolutePath: outputPath,
      currentImageExists: existsSync(outputPath),
      repositoryPath: outputRepositoryPath,
    },
    references: {
      availablePaths,
      directory: referenceDirectory,
      readmePath: join(referenceDirectory, "README.md"),
      selected,
      selectedPaths: selected.map(({ path }) => path),
    },
    repositoryRoot,
    schemaVersion: 2,
  };
}

function srgbChannelToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function percentile(sortedValues: number[], fraction: number): number {
  if (sortedValues.length === 0) return fail("Cannot measure an empty image");
  const index = Math.floor((sortedValues.length - 1) * fraction);
  return sortedValues[index] ?? fail("Cannot resolve image percentile");
}

function median(values: number[]): number {
  if (values.length === 0) return fail("Cannot measure an empty reference set");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? fail("Cannot resolve reference median");
  }
  const left = sorted[middle - 1] ?? fail("Cannot resolve reference median");
  const right = sorted[middle] ?? fail("Cannot resolve reference median");
  return (left + right) / 2;
}

export async function measureImage(path: string): Promise<ImageMetrics> {
  if (!existsSync(path)) return fail(`Image not found: ${path}`);

  const { data, info } = await sharp(path)
    .resize(ANALYSIS_WIDTH, ANALYSIS_HEIGHT, { fit: "fill" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const luminances: number[] = [];
  let darkPixels = 0;
  let edgeLuminance = 0;
  let edgePixels = 0;
  let saturation = 0;
  const edgeWidth = Math.max(1, Math.round(info.width * EDGE_FRACTION));
  const edgeHeight = Math.max(1, Math.round(info.height * EDGE_FRACTION));

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const luminance =
        0.2126 * srgbChannelToLinear(red) +
        0.7152 * srgbChannelToLinear(green) +
        0.0722 * srgbChannelToLinear(blue);
      luminances.push(luminance);
      if (luminance < DARK_LUMINANCE) darkPixels += 1;

      const normalizedRed = red / 255;
      const normalizedGreen = green / 255;
      const normalizedBlue = blue / 255;
      const maximum = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
      const minimum = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
      const lightness = (maximum + minimum) / 2;
      saturation +=
        maximum === minimum
          ? 0
          : (maximum - minimum) / (1 - Math.abs(2 * lightness - 1));

      if (
        x < edgeWidth ||
        x >= info.width - edgeWidth ||
        y < edgeHeight ||
        y >= info.height - edgeHeight
      ) {
        edgeLuminance += luminance;
        edgePixels += 1;
      }
    }
  }

  luminances.sort((left, right) => left - right);
  const pixelCount = luminances.length;
  return {
    darkPixelRatio: roundMetric(darkPixels / pixelCount),
    edgeMeanLuminance: roundMetric(edgeLuminance / edgePixels),
    meanLuminance: roundMetric(
      luminances.reduce((total, value) => total + value, 0) / pixelCount,
    ),
    meanSaturation: roundMetric(saturation / pixelCount),
    p10Luminance: roundMetric(percentile(luminances, 0.1)),
    p50Luminance: roundMetric(percentile(luminances, 0.5)),
  };
}

function minimumCheck(
  id: StyleCheck["id"],
  actual: number,
  limit: number,
): StyleCheck {
  const roundedLimit = roundMetric(limit);
  return {
    actual,
    id,
    limit: roundedLimit,
    passed: actual >= roundedLimit,
    rule: "minimum",
  };
}

function maximumCheck(
  id: StyleCheck["id"],
  actual: number,
  limit: number,
): StyleCheck {
  const roundedLimit = roundMetric(limit);
  return {
    actual,
    id,
    limit: roundedLimit,
    passed: actual <= roundedLimit,
    rule: "maximum",
  };
}

export async function analyzeEditorialStyle(
  candidatePath: string,
  references: ReferenceSelection[],
): Promise<StyleAnalysis> {
  if (references.length < 3) {
    return fail("Tone analysis requires the role-labeled reference set");
  }

  const [candidateMetrics, referenceMetrics] = await Promise.all([
    measureImage(candidatePath),
    Promise.all(
      references.map(async (reference) => ({
        ...reference,
        metrics: await measureImage(reference.path),
      })),
    ),
  ]);
  const toneMetrics = referenceMetrics
    .filter(({ role }) => role === "palette" || role === "contrast")
    .map(({ metrics }) => metrics);
  if (toneMetrics.length === 0) {
    return fail("Tone analysis requires a palette reference");
  }
  const minimumMeanLuminance = Math.max(
    0.12,
    Math.min(...toneMetrics.map(({ meanLuminance }) => meanLuminance)) * 0.45,
  );
  const minimumP10Luminance = Math.max(
    0.04,
    Math.min(...toneMetrics.map(({ p10Luminance }) => p10Luminance)) * 0.35,
  );
  const minimumEdgeLuminance = Math.max(
    0.09,
    Math.min(...toneMetrics.map(({ edgeMeanLuminance }) => edgeMeanLuminance)) *
      0.4,
  );
  const maximumDarkPixelRatio = Math.min(
    0.25,
    Math.max(...toneMetrics.map(({ darkPixelRatio }) => darkPixelRatio)) + 0.18,
  );
  const minimumMeanSaturation = Math.max(
    0.16,
    median(toneMetrics.map(({ meanSaturation }) => meanSaturation)) * 0.35,
  );
  const checks = [
    minimumCheck(
      "mean-luminance",
      candidateMetrics.meanLuminance,
      minimumMeanLuminance,
    ),
    minimumCheck(
      "p10-luminance",
      candidateMetrics.p10Luminance,
      minimumP10Luminance,
    ),
    minimumCheck(
      "edge-luminance",
      candidateMetrics.edgeMeanLuminance,
      minimumEdgeLuminance,
    ),
    maximumCheck(
      "dark-pixel-ratio",
      candidateMetrics.darkPixelRatio,
      maximumDarkPixelRatio,
    ),
    minimumCheck(
      "mean-saturation",
      candidateMetrics.meanSaturation,
      minimumMeanSaturation,
    ),
  ];

  return {
    candidate: {
      metrics: candidateMetrics,
      path: candidatePath,
    },
    checks,
    ok: checks.every(({ passed }) => passed),
    references: referenceMetrics,
  };
}

export async function validateImage(path: string): Promise<void> {
  if (!existsSync(path)) return fail(`Image not found: ${path}`);

  const metadata = await sharp(path).metadata();
  if (metadata.format !== "png")
    return fail(`Expected PNG, received ${metadata.format}`);
  if (metadata.width !== TARGET_WIDTH || metadata.height !== TARGET_HEIGHT) {
    return fail(
      `Expected ${TARGET_WIDTH}x${TARGET_HEIGHT}, received ${metadata.width}x${metadata.height}`,
    );
  }
  if (metadata.space !== "srgb" || metadata.channels !== 3) {
    return fail(
      `Expected three-channel sRGB, received ${metadata.space ?? "unknown"} with ${metadata.channels ?? "unknown"} channels`,
    );
  }
}

export async function finalizeImage(
  inputPath: string,
  outputPath: string,
  references: ReferenceSelection[],
): Promise<StyleAnalysis> {
  const inputMetadata = await sharp(inputPath).metadata();
  if (inputMetadata.width === undefined || inputMetadata.height === undefined) {
    return fail(`Cannot read input dimensions: ${inputPath}`);
  }

  const inputAspectRatio = inputMetadata.width / inputMetadata.height;
  if (Math.abs(inputAspectRatio - TARGET_ASPECT_RATIO) > 0.03) {
    return fail(
      `Generated image aspect ratio must be close to 3:2, received ${inputMetadata.width}x${inputMetadata.height}`,
    );
  }

  if (inputMetadata.hasAlpha) {
    const alphaChannel = (await sharp(inputPath).stats()).channels[3];
    if (alphaChannel !== undefined && alphaChannel.min < 255) {
      return fail(
        "Generated image must be full-bleed and cannot contain transparent pixels",
      );
    }
  }

  const analysis = await analyzeEditorialStyle(inputPath, references);
  if (!analysis.ok) {
    const failedChecks = analysis.checks
      .filter(({ passed }) => !passed)
      .map(
        ({ actual, id, limit, rule }) =>
          `${id} ${actual} violates ${rule} ${limit}`,
      )
      .join("; ");
    return fail(`Editorial tone analysis failed: ${failedChecks}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}.png`;
  try {
    await sharp(inputPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "centre" })
      .toColourspace("srgb")
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toFile(temporaryPath);
    await validateImage(temporaryPath);
    await rename(temporaryPath, outputPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  return analysis;
}

function printUsage(): void {
  process.stdout.write(`Usage:
  bunx --bun generate-article-image prepare --article <mdx-path> [--reference <role>=<filename> ...]
  bunx --bun generate-article-image analyze --article <mdx-path> --input <generated-image> --reference <role>=<filename> ...
  bunx --bun generate-article-image finalize --article <mdx-path> --input <generated-image> --reference <role>=<filename> ...
  bunx --bun generate-article-image validate --article <mdx-path>

Required reference roles: composition, palette, material
Optional reference roles: contrast, motion
`);
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: Bun.argv.slice(2),
    options: {
      article: { short: "a", type: "string" },
      help: { short: "h", type: "boolean" },
      input: { short: "i", type: "string" },
      reference: { multiple: true, type: "string" },
      root: { type: "string" },
    },
    strict: true,
  });

  if (values.help === true) {
    printUsage();
    return;
  }

  const command = positionals[0];
  if (
    !new Set(["prepare", "analyze", "finalize", "validate"]).has(command ?? "")
  ) {
    printUsage();
    return fail("Expected prepare, analyze, finalize, or validate command");
  }
  if (values.article === undefined) return fail("--article is required");

  const context = await resolveArticleContext(
    values.article,
    values.reference ?? [],
    values.root,
  );

  if (command === "prepare") {
    process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
    return;
  }

  if (command === "validate") {
    await validateImage(context.output.absolutePath);
    process.stdout.write(
      `${JSON.stringify({ ok: true, output: context.output.repositoryPath }, null, 2)}\n`,
    );
    return;
  }

  if (values.input === undefined) {
    return fail(`--input is required for ${command}`);
  }
  if (context.references.selected.length < 3) {
    return fail(`${command} requires the role-labeled reference set`);
  }
  const inputPath = resolve(values.input);
  if (!existsSync(inputPath)) {
    return fail(`Generated image not found: ${inputPath}`);
  }

  if (command === "analyze") {
    const analysis = await analyzeEditorialStyle(
      inputPath,
      context.references.selected,
    );
    process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
    if (!analysis.ok) process.exitCode = 2;
    return;
  }

  const analysis = await finalizeImage(
    inputPath,
    context.output.absolutePath,
    context.references.selected,
  );
  process.stdout.write(
    `${JSON.stringify(
      { analysis, ok: true, output: context.output.repositoryPath },
      null,
      2,
    )}\n`,
  );
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`generate-article-image: ${message}\n`);
    process.exitCode = 1;
  });
}
