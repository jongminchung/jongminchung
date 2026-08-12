import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { renderIconSvg } from "./index.ts";
import { iconAssetTargets, type IconAssetTarget } from "./targets.ts";

export interface IconAssetDifference {
    readonly path: string;
    readonly reason: string;
}

type GeneratedIconAsset = Readonly<{
    content: string;
    target: IconAssetTarget;
}>;

function createGeneratedAsset(target: IconAssetTarget): GeneratedIconAsset {
    return Object.freeze({ content: renderIconSvg(target.variant), target });
}

function createGeneratedAssets(): readonly GeneratedIconAsset[] {
    return iconAssetTargets.map(createGeneratedAsset);
}

function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && "code" in error && error.code === code;
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

    return actual.equals(Buffer.from(asset.content))
        ? null
        : {
              path: asset.target.path,
              reason: "SVG does not match the canonical source",
          };
}

export async function generateIconAssets(workspaceRoot: string): Promise<void> {
    const assets = createGeneratedAssets();
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
    const assets = createGeneratedAssets();
    const assetDifferences = await Promise.all(
        assets.map(
            async (asset): Promise<IconAssetDifference | null> =>
                compareGeneratedAsset(workspaceRoot, asset),
        ),
    );
    return assetDifferences.filter(
        (result): result is IconAssetDifference => result !== null,
    );
}
