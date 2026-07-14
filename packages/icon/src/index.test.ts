import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createIconDataUrl,
  iconPalette,
  iconPreviewSizes,
  iconVariants,
  renderIconSvg,
} from "./index.ts";
import { iconApplicationIds, iconAssetTargets } from "./targets.ts";

const forbiddenSvgContent =
  /<(?:text|image|foreignObject|linearGradient|radialGradient|filter)\b|(?:font-family|href=|url\()/iu;

async function readCenterPixel(svg: string, size: number): Promise<readonly number[]> {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const center = Math.floor(size / 2);
  const offset = (center * info.width + center) * info.channels;
  return [...data.subarray(offset, offset + info.channels)];
}

describe("app icon source", () => {
  it("defines unique variants, preview sizes, and output paths", () => {
    expect(new Set(iconVariants).size).toBe(iconVariants.length);
    expect(new Set(iconPreviewSizes).size).toBe(iconPreviewSizes.length);
    expect(new Set(iconAssetTargets.map((target) => target.path)).size).toBe(
      iconAssetTargets.length,
    );
    expect(new Set(iconAssetTargets.map((target) => target.app))).toEqual(
      new Set(iconApplicationIds),
    );
    expect(iconAssetTargets.every((target) => target.path.startsWith(`apps/${target.app}/`))).toBe(
      true,
    );
    const productPngSizes = iconAssetTargets.flatMap((target) =>
      target.kind === "png" ? [target.size] : [],
    );
    expect(productPngSizes).toEqual([16, 32, 48, 96, 128]);
    expect(new Set(productPngSizes).size).toBe(productPngSizes.length);
  });

  it.each(iconVariants)("renders safe standalone SVG for %s", (variant) => {
    const svg = renderIconSvg(variant);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+">/u);
    expect(svg).not.toMatch(forbiddenSvgContent);
    expect(createIconDataUrl(variant)).toBe(`data:image/svg+xml;base64,${btoa(svg)}`);
  });

  it.each(iconVariants)("keeps the open center visible for %s at 16px", async (variant) => {
    const center = await readCenterPixel(renderIconSvg(variant), 16);
    expect(center).toEqual([18, 24, 38, 255]);
    expect(iconPalette.deepInk).toBe("#121826");
  });
});
