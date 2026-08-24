import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, "").split("=");
    return [key, value.length === 0 ? true : value.join("=")];
  }),
);

if (!options.root || !options.app) {
  throw new Error(
    "Usage: --app=<name> --root=<asset-directory> [--baseline=<json>] [--output=<json>] [--update-baseline]",
  );
}

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetRoot = resolve(repositoryRoot, options.root);
const extensions = new Set([".css", ".js", ".mjs"]);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? filesBelow(path) : [path];
    }),
  );
  return nested.flat();
}

function logicalName(path) {
  return basename(path).replace(
    /-[A-Za-z0-9_-]{8,}(?=\.(?:css|m?js)$)/,
    "-[hash]",
  );
}

const paths = (await filesBelow(assetRoot))
  .filter((path) => extensions.has(extname(path)))
  .sort();
const assets = await Promise.all(
  paths.map(async (path) => {
    const content = await readFile(path);
    return {
      path: relative(repositoryRoot, path).replace(
        basename(path),
        logicalName(path),
      ),
      logicalName: logicalName(path),
      type: extname(path) === ".css" ? "css" : "javascript",
      bytes: content.byteLength,
      gzipBytes: gzipSync(content).byteLength,
    };
  }),
);
assets.sort(
  (left, right) =>
    left.logicalName.localeCompare(right.logicalName) ||
    left.bytes - right.bytes ||
    left.gzipBytes - right.gzipBytes,
);
const logicalNameCounts = new Map();
for (const asset of assets) {
  logicalNameCounts.set(
    asset.logicalName,
    (logicalNameCounts.get(asset.logicalName) ?? 0) + 1,
  );
}
const logicalNameOccurrences = new Map();
for (const asset of assets) {
  if ((logicalNameCounts.get(asset.logicalName) ?? 0) < 2) continue;
  const occurrence = (logicalNameOccurrences.get(asset.logicalName) ?? 0) + 1;
  logicalNameOccurrences.set(asset.logicalName, occurrence);
  asset.logicalName = `${asset.logicalName}#${occurrence}`;
}

const totals = Object.fromEntries(
  ["javascript", "css"].map((type) => {
    const selected = assets.filter((asset) => asset.type === type);
    return [
      type,
      {
        files: selected.length,
        bytes: selected.reduce((sum, asset) => sum + asset.bytes, 0),
        gzipBytes: selected.reduce((sum, asset) => sum + asset.gzipBytes, 0),
      },
    ];
  }),
);

const report = {
  schemaVersion: 1,
  app: options.app,
  assetRoot: relative(repositoryRoot, assetRoot),
  totals,
  assets,
};

if (options.baseline) {
  const baselinePath = resolve(repositoryRoot, options.baseline);
  if (options["update-baseline"]) {
    await writeFile(baselinePath, `${JSON.stringify(report, null, 2)}\n`);
  } else {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
    const thresholds = {
      javascript: { bytes: 102_400, gzipBytes: 30_720 },
      css: { bytes: 20_480, gzipBytes: 6_144 },
    };
    const baselineAssets = new Map(
      baseline.assets.map((asset) => [asset.logicalName, asset]),
    );
    report.comparison = Object.fromEntries(
      ["javascript", "css"].map((type) => {
        const difference = {
          bytes: report.totals[type].bytes - baseline.totals[type].bytes,
          gzipBytes:
            report.totals[type].gzipBytes - baseline.totals[type].gzipBytes,
        };
        const largestChanges = assets
          .filter((asset) => asset.type === type)
          .map((asset) => ({
            logicalName: asset.logicalName,
            bytes:
              asset.bytes - (baselineAssets.get(asset.logicalName)?.bytes ?? 0),
            gzipBytes:
              asset.gzipBytes -
              (baselineAssets.get(asset.logicalName)?.gzipBytes ?? 0),
          }))
          .filter((asset) => asset.bytes !== 0 || asset.gzipBytes !== 0)
          .sort(
            (left, right) =>
              Math.abs(right.gzipBytes) - Math.abs(left.gzipBytes),
          )
          .slice(0, 10);
        return [
          type,
          {
            ...difference,
            thresholds: thresholds[type],
            exceeded:
              difference.bytes > thresholds[type].bytes ||
              difference.gzipBytes > thresholds[type].gzipBytes,
            largestChanges,
          },
        ];
      }),
    );
  }
}

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) {
  await writeFile(resolve(repositoryRoot, options.output), serialized);
}
process.stdout.write(serialized);
