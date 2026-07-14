import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { renderIconSvg } from "./index.ts";
import { iconAssetTargets, type IconAssetTarget } from "./targets.ts";

export interface IconAssetDifference {
  readonly path: string;
  readonly reason: string;
}

type GeneratedIconAsset =
  | Readonly<{ content: string; target: Extract<IconAssetTarget, { kind: "svg" }> }>
  | Readonly<{ content: Buffer; target: Extract<IconAssetTarget, { kind: "png" }> }>;

interface RawImage {
  readonly channels: number;
  readonly data: Buffer;
  readonly height: number;
  readonly width: number;
}

async function renderPng(target: Extract<IconAssetTarget, { kind: "png" }>): Promise<Buffer> {
  return sharp(Buffer.from(renderIconSvg(target.variant)))
    .resize(target.size, target.size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function createGeneratedAsset(target: IconAssetTarget): Promise<GeneratedIconAsset> {
  if (target.kind === "svg") {
    return Object.freeze({ content: renderIconSvg(target.variant), target });
  }
  return Object.freeze({ content: await renderPng(target), target });
}

async function createGeneratedAssets(): Promise<readonly GeneratedIconAsset[]> {
  return Promise.all(iconAssetTargets.map(createGeneratedAsset));
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function listWorkspaceApplicationIds(workspaceRoot: string): Promise<readonly string[]> {
  const applicationsRoot = resolve(workspaceRoot, "apps");
  const entries = await readdir(applicationsRoot, { withFileTypes: true });
  const applications = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry): Promise<string | null> => {
        try {
          await access(resolve(applicationsRoot, entry.name, "package.json"));
          return entry.name;
        } catch (error: unknown) {
          if (hasErrorCode(error, "ENOENT")) return null;
          throw error;
        }
      }),
  );
  return applications.filter((application): application is string => application !== null).sort();
}

async function findApplicationMappingDifferences(
  workspaceRoot: string,
): Promise<readonly IconAssetDifference[]> {
  const applications = await listWorkspaceApplicationIds(workspaceRoot);
  const registeredApplications = new Set<string>(iconAssetTargets.map((target) => target.app));
  const applicationSet = new Set(applications);
  return [
    ...applications
      .filter((application) => !registeredApplications.has(application))
      .map((application) => ({
        path: `apps/${application}/package.json`,
        reason: "app has no registered icon target",
      })),
    ...[...registeredApplications]
      .filter((application) => !applicationSet.has(application))
      .map((application) => ({
        path: `apps/${application}/package.json`,
        reason: "icon target references an app without package.json",
      })),
  ];
}

async function decodePng(content: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(content)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Object.freeze({
    channels: info.channels,
    data,
    height: info.height,
    width: info.width,
  });
}

function countMaterialPixelDifferences(expected: RawImage, actual: RawImage): number {
  let differentPixels = 0;
  for (let offset = 0; offset < expected.data.length; offset += expected.channels) {
    let materiallyDifferent = false;
    for (let channel = 0; channel < expected.channels; channel += 1) {
      const expectedValue = expected.data[offset + channel];
      const actualValue = actual.data[offset + channel];
      if (
        expectedValue === undefined ||
        actualValue === undefined ||
        Math.abs(expectedValue - actualValue) > 1
      ) {
        materiallyDifferent = true;
        break;
      }
    }
    if (materiallyDifferent) differentPixels += 1;
  }
  return differentPixels;
}

async function comparePng(expected: Buffer, actual: Buffer): Promise<string | null> {
  const expectedImage = await decodePng(expected);
  let actualImage: RawImage;
  try {
    actualImage = await decodePng(actual);
  } catch (error: unknown) {
    return error instanceof Error ? `PNG could not be decoded: ${error.message}` : "invalid PNG";
  }
  if (
    expectedImage.width !== actualImage.width ||
    expectedImage.height !== actualImage.height ||
    expectedImage.channels !== actualImage.channels
  ) {
    return `expected ${expectedImage.width}x${expectedImage.height}, received ${actualImage.width}x${actualImage.height}`;
  }

  const differentPixels = countMaterialPixelDifferences(expectedImage, actualImage);
  const pixelCount = expectedImage.width * expectedImage.height;
  const allowedDifferences = Math.max(1, Math.ceil(pixelCount * 0.001));
  return differentPixels > allowedDifferences
    ? `${differentPixels} pixels differ from the canonical render`
    : null;
}

async function compareGeneratedAsset(
  workspaceRoot: string,
  asset: GeneratedIconAsset,
): Promise<IconAssetDifference | null> {
  const outputPath = resolve(workspaceRoot, asset.target.path);
  let actual: Buffer;
  try {
    actual = await readFile(outputPath);
  } catch (error: unknown) {
    if (hasErrorCode(error, "ENOENT")) {
      return { path: asset.target.path, reason: "file is missing" };
    }
    throw error;
  }

  if (typeof asset.content === "string") {
    return actual.equals(Buffer.from(asset.content))
      ? null
      : { path: asset.target.path, reason: "SVG does not match the canonical source" };
  }

  const reason = await comparePng(asset.content, actual);
  return reason === null ? null : { path: asset.target.path, reason };
}

export async function generateIconAssets(workspaceRoot: string): Promise<void> {
  const assets = await createGeneratedAssets();
  await Promise.all(
    assets.map(async (asset): Promise<void> => {
      const outputPath = resolve(workspaceRoot, asset.target.path);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, asset.content);
    }),
  );
}

export async function checkIconAssets(
  workspaceRoot: string,
): Promise<readonly IconAssetDifference[]> {
  const [assets, mappingDifferences] = await Promise.all([
    createGeneratedAssets(),
    findApplicationMappingDifferences(workspaceRoot),
  ]);
  const assetDifferences = await Promise.all(
    assets.map(
      async (asset): Promise<IconAssetDifference | null> =>
        compareGeneratedAsset(workspaceRoot, asset),
    ),
  );
  return [
    ...mappingDifferences,
    ...assetDifferences.filter((result): result is IconAssetDifference => result !== null),
  ];
}
