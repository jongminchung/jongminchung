import type { ComponentType } from "react";
import type { Locale } from "#lib/content-model";

export type MaterialRenderer = "svg-motion" | "dom-motion" | "canvas" | "wasm";
export type MaterialTopic =
  | "ascii-3d-renderer"
  | "beyond-beautiful-code"
  | "building-3d-illusion-game"
  | "building-calculator-engine"
  | "building-coding-agent"
  | "building-email-relay-system"
  | "building-llm"
  | "building-nes-emulator"
  | "do-we-really-know-pagination"
  | "encrypted-share-vault-system"
  | "feeling-claude-blue"
  | "frontend-caching-strategies"
  | "hamssun-python-lisp"
  | "headless-react-component"
  | "how-to-design-animation"
  | "how-to-whittle-a-skill"
  | "implementing-genetic-algorithm"
  | "it-is-the-boundary-stupid"
  | "modeling-series-view-model"
  | "react-component-based-thinking"
  | "server-monitoring-analysis-guide"
  | "the-expensive-main-thread"
  | "the-weight-of-trivial-code"
  | "throughput-and-latency";

export type MaterialId = `${MaterialTopic}/${string}`;

export interface MaterialDemoProps {
  readonly id: MaterialId;
}

export interface MaterialComponentProps {
  readonly locale: Locale;
  readonly active: boolean;
  readonly reducedMotion: boolean;
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
