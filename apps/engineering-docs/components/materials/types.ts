import type { ComponentType, ReactNode } from "react";
import type { Locale } from "#lib/content-model";
import type {
    MaterialId,
    MaterialTopic,
} from "../../generated/materials-types";

export type {
    MaterialId,
    MaterialTopic,
} from "../../generated/materials-types";

export type MaterialRenderer = "svg-motion" | "dom-motion" | "canvas";

export interface MaterialDemoProps {
    readonly id: MaterialId;
}

export interface MaterialComponentProps {
    readonly locale: Locale;
    readonly active: boolean;
    readonly reducedMotion: boolean;
    readonly children: ReactNode;
    readonly caption?: string;
}

export interface MaterialManifestEntry {
    readonly id: MaterialId;
    readonly topic: MaterialTopic;
    readonly name: string;
    readonly renderer: MaterialRenderer;
    readonly minHeight: number;
    readonly component: ComponentType<MaterialComponentProps>;
    readonly preload: () => Promise<unknown>;
}
