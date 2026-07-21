import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { decodePng } from "./visual-compare.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_APP_ROOT = resolve(scriptDirectory, "../..");
export const DEFAULT_PARITY_ROOT = resolve(DEFAULT_APP_ROOT, "parity/rebased/1.1.8");

const themeName = z.enum(["light", "dark"]);
const contractSchema = z.object({
  schemaVersion: z.literal(1),
  reference: z.object({ product: z.literal("Rebased"), version: z.literal("1.1.8") }),
  thresholds: z.object({
    maximumChannelDelta: z.number().nonnegative(),
    maximumGeometryDeltaCssPixels: z.number().nonnegative(),
    maximumMismatchPercent: z.number().nonnegative(),
    minimumStructuralSsim: z.number().min(0).max(1),
  }),
  themes: z.record(
    themeName,
    z.object({ sourceTheme: z.string().min(1), tokens: z.record(z.string(), z.string().min(1)) }),
  ),
  geometry: z.object({
    mainToolbar: z.number().positive(),
    logTab: z.number().positive(),
    compactRow: z.number().positive(),
    statusBar: z.number().positive(),
  }),
  goldens: z.array(
    z.object({
      path: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/u),
      width: z.number().positive(),
      height: z.number().positive(),
      theme: themeName,
    }),
  ),
});

const extractedThemesSchema = z.object({
  themes: z.array(
    z.object({
      name: z.string(),
      definition: z.object({ colors: z.record(z.string(), z.string()).optional() }).passthrough(),
    }),
  ),
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadThemeParityContract(parityRoot = DEFAULT_PARITY_ROOT) {
  return contractSchema.parse(readJson(join(parityRoot, "manifest/theme-contract.json")));
}

function resolveSourceColor(colors, name, trail = []) {
  if (trail.includes(name))
    throw new Error(`Theme color alias cycle: ${[...trail, name].join(" -> ")}`);
  const value = colors[name];
  if (value === undefined) throw new Error(`Missing Rebased color role: ${name}`);
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/iu.test(value) || value === "transparent") return value;
  return resolveSourceColor(colors, value, [...trail, name]);
}

export function resolveThemeColors(contract, parityRoot = DEFAULT_PARITY_ROOT) {
  const extracted = extractedThemesSchema.parse(readJson(join(parityRoot, "source/themes.json")));
  return Object.fromEntries(
    themeName.options.map((mode) => {
      const declaration = contract.themes[mode];
      const source = extracted.themes.find(
        (candidate) => candidate.name === declaration.sourceTheme,
      );
      if (source === undefined)
        throw new Error(`Missing extracted theme: ${declaration.sourceTheme}`);
      if (source.definition.colors === undefined) {
        throw new Error(`Extracted theme has no color table: ${declaration.sourceTheme}`);
      }
      return [
        mode,
        Object.fromEntries(
          Object.entries(declaration.tokens).map(([token, role]) => [
            token,
            resolveSourceColor(source.definition.colors, role),
          ]),
        ),
      ];
    }),
  );
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:css|ts|tsx)$/u.test(entry.name) ? [path] : [];
  });
}

function declaredTokens(block) {
  return new Set([...block.matchAll(/--([a-z][\w-]*)\s*:/gu)].map((match) => match[1]));
}

function themeBlocks(stylesheet) {
  const light = /:root\s*\{([\s\S]*?)\n\}/u.exec(stylesheet)?.[1];
  const dark = /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/u.exec(stylesheet)?.[1];
  if (light === undefined || dark === undefined)
    throw new Error("Theme stylesheet must define light and dark root blocks");
  return { light, dark };
}

export function verifyThemeContract(appRoot = DEFAULT_APP_ROOT) {
  const parityRoot = join(appRoot, "parity/rebased/1.1.8");
  const contract = loadThemeParityContract(parityRoot);
  const expected = resolveThemeColors(contract, parityRoot);
  const themePath = join(appRoot, "src/styles/theme.css");
  const stylesheet = readFileSync(themePath, "utf8");
  const blocks = themeBlocks(stylesheet);
  const failures = [];

  if (/#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/iu.test(stylesheet)) {
    failures.push("theme.css must express app-owned colors with OKLCH");
  }
  for (const mode of themeName.options) {
    const tokens = declaredTokens(blocks[mode]);
    for (const token of Object.keys(expected[mode])) {
      if (!tokens.has(token) && mode === "light")
        failures.push(`light theme is missing --${token}`);
      if (!tokens.has(token) && mode === "dark" && !declaredTokens(blocks.light).has(token)) {
        failures.push(`dark theme cannot inherit missing --${token}`);
      }
    }
  }

  const literalColor = /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(/iu;
  const paletteUtility =
    /\b(?:bg|border|fill|ring|stroke|text)-(?:amber|black|blue|gray|green|grey|neutral|purple|red|slate|stone|white|zinc)(?:-\d+)?(?:\/\d+)?\b/u;
  for (const path of sourceFiles(join(appRoot, "src"))) {
    if (path === themePath || /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)) continue;
    const contents = readFileSync(path, "utf8");
    if (literalColor.test(contents))
      failures.push(`${relative(appRoot, path)} contains a literal color`);
    if (paletteUtility.test(contents))
      failures.push(`${relative(appRoot, path)} contains a Tailwind palette utility`);
  }

  for (const golden of contract.goldens) {
    const path = join(parityRoot, golden.path);
    const bytes = readFileSync(path);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const image = decodePng(bytes, golden.path);
    if (hash !== golden.sha256) failures.push(`${golden.path} has an unapproved hash`);
    if (image.width !== golden.width || image.height !== golden.height) {
      failures.push(`${golden.path} has unexpected dimensions ${image.width}x${image.height}`);
    }
  }

  if (failures.length > 0) throw new Error(`Theme parity contract failed:\n${failures.join("\n")}`);
  return Object.freeze({
    goldens: contract.goldens.length,
    themes: themeName.options.length,
    tokens: Object.keys(contract.themes.light.tokens).length,
  });
}
