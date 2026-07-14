import type { IconVariant } from "./index.ts";

export const iconApplicationIds = ["docs", "immersive-translate", "readme"] as const;

export type IconApplicationId = (typeof iconApplicationIds)[number];

export interface IconSvgTarget {
  readonly app: IconApplicationId;
  readonly kind: "svg";
  readonly path: string;
  readonly variant: IconVariant;
}

export interface IconPngTarget {
  readonly app: "immersive-translate";
  readonly kind: "png";
  readonly path: string;
  readonly size: 16 | 32 | 48 | 96 | 128;
  readonly variant: "immersive-translate";
}

export type IconAssetTarget = IconPngTarget | IconSvgTarget;

export const iconAssetTargets = [
  {
    app: "readme",
    kind: "svg",
    path: "apps/readme/app/icon.svg",
    variant: "personal",
  },
  {
    app: "docs",
    kind: "svg",
    path: "apps/docs/app/icon.svg",
    variant: "personal",
  },
  {
    app: "immersive-translate",
    kind: "svg",
    path: "apps/immersive-translate/public/icon/icon.svg",
    variant: "immersive-translate",
  },
  ...([16, 32, 48, 96, 128] as const).map((size) => ({
    app: "immersive-translate" as const,
    kind: "png" as const,
    path: `apps/immersive-translate/public/icon/${size}.png`,
    size,
    variant: "immersive-translate" as const,
  })),
] as const satisfies readonly IconAssetTarget[];
