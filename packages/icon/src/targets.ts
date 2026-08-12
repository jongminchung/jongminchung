import type { IconVariant } from "./index.ts";

export interface IconAssetTarget {
    readonly app: "engineering-docs" | "readme";
    readonly kind: "svg";
    readonly path: string;
    readonly variant: IconVariant;
}

export const iconAssetTargets = [
    {
        app: "readme",
        kind: "svg",
        path: "apps/readme/app/icon.svg",
        variant: "personal",
    },
    {
        app: "engineering-docs",
        kind: "svg",
        path: "apps/engineering-docs/app/icon.svg",
        variant: "personal",
    },
] as const satisfies readonly IconAssetTarget[];
