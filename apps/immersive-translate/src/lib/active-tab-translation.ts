import type { BilingualCaptionCue, CaptionCueLike, CaptionTrackLike } from "./caption-translation";
import type {
  CaptionDisplayPreferences,
  LocalTranslationSettings,
  TranslationJobProgress,
} from "./local-translation";
import { captionDisplayPreferencesFromSettings } from "./local-translation";
import {
  isWebpageDisplayMode,
  type TranslatedWebpageTextBlock,
  type WebpageDisplayMode,
  type WebpageTextBlock,
} from "./webpage-translation";

export interface ActiveTabPageSupport {
  readonly supported: boolean;
  readonly reason: string | null;
}

export const ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE =
  "immersive-translate.active-tab-translation.control";
export const ACTIVE_TAB_TRANSLATION_PAGE_SCOPE = "immersive-translate.active-tab-translation.page";

export type ActiveTabTranslationControlRequest =
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "status";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "install-bridge";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "run-caption-translation";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "cancel-caption-translation";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "run-generated-caption-translation";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "cancel-generated-caption-translation";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "clear-caption-overlay";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "run-webpage-translation";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "cancel-webpage-translation";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "clear-webpage-translation";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "set-webpage-display-mode";
      readonly displayMode: WebpageDisplayMode;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE;
      readonly type: "set-caption-display-preferences";
      readonly preferences: CaptionDisplayPreferences;
    };

export type ActiveTabTranslationBridgeRequest =
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "collect-caption-track";
      readonly youtubePlayerResponse?: unknown;
      readonly selectedBaseUrl?: string;
      readonly selectedLabel?: string;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "render-caption-overlay";
      readonly trackLabel: string | null;
      readonly cues: readonly BilingualCaptionCue[];
      readonly preferences: CaptionDisplayPreferences;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "set-caption-display-preferences";
      readonly preferences: CaptionDisplayPreferences;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "show-caption-state";
      readonly captionState: ActiveTabCaptionState;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "show-generated-caption-state";
      readonly generatedCaptionState: ActiveTabGeneratedCaptionState;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "clear-caption-overlay";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "collect-webpage-text";
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "render-webpage-translation";
      readonly blocks: readonly TranslatedWebpageTextBlock[];
      readonly displayMode: WebpageDisplayMode;
      readonly targetLanguage: string;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "show-webpage-state";
      readonly webpageState: ActiveTabWebpageState;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "set-webpage-display-mode";
      readonly displayMode: WebpageDisplayMode;
    }
  | {
      readonly scope: typeof ACTIVE_TAB_TRANSLATION_PAGE_SCOPE;
      readonly type: "clear-webpage-translation";
    };

export type ActiveTabTranslationBridgeState = "available" | "ready" | "unsupported";
export type ActiveTabTranslationLocalState = "enabled" | "disabled";
export type ActiveTabCaptionStateName =
  | "idle"
  | "detecting"
  | "no-captions"
  | "translating"
  | "rendered"
  | "failed"
  | "cancelled";

export interface ActiveTabCaptionState {
  readonly name: ActiveTabCaptionStateName;
  readonly message: string;
  readonly cueCount: number;
  readonly trackLabel: string | null;
  readonly progress: TranslationJobProgress | null;
}

export type ActiveTabGeneratedCaptionStateName =
  | "idle"
  | "capturing"
  | "transcribing"
  | "translating"
  | "rendered"
  | "failed"
  | "cancelled";

export interface ActiveTabGeneratedCaptionState {
  readonly name: ActiveTabGeneratedCaptionStateName;
  readonly message: string;
  readonly cueCount: number;
  readonly trackLabel: string | null;
  readonly progress: TranslationJobProgress | null;
}

export type ActiveTabWebpageStateName =
  | "idle"
  | "collecting"
  | "no-content"
  | "translating"
  | "rendered"
  | "failed"
  | "cancelled";

export interface ActiveTabWebpageState {
  readonly name: ActiveTabWebpageStateName;
  readonly message: string;
  readonly blockCount: number;
  readonly displayMode: WebpageDisplayMode;
  readonly progress: TranslationJobProgress | null;
}

export type ActiveTabCaptionCollectionResponse =
  | {
      readonly ok: true;
      readonly state: "captions";
      readonly track: CaptionTrackLike;
      readonly currentTimeSeconds: number | null;
    }
  | {
      readonly ok: true;
      readonly state: "no-captions";
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly state: "failed";
      readonly message: string;
    };

export type ActiveTabWebpageCollectionResponse =
  | {
      readonly ok: true;
      readonly state: "blocks";
      readonly blocks: readonly WebpageTextBlock[];
    }
  | {
      readonly ok: true;
      readonly state: "no-content";
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly state: "failed";
      readonly message: string;
    };

export const ACTIVE_TAB_CAPTION_IDLE_STATE: ActiveTabCaptionState = {
  name: "idle",
  message: "Caption translation has not run yet.",
  cueCount: 0,
  trackLabel: null,
  progress: null,
};

export const ACTIVE_TAB_WEBPAGE_IDLE_STATE: ActiveTabWebpageState = {
  name: "idle",
  message: "Webpage translation has not run yet.",
  blockCount: 0,
  displayMode: "bilingual",
  progress: null,
};

export const ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE: ActiveTabGeneratedCaptionState = {
  name: "idle",
  message: "Generated captions have not run yet.",
  cueCount: 0,
  trackLabel: null,
  progress: null,
};

export interface ActiveTabTranslationStatus {
  readonly tabId: number | null;
  readonly tabTitle: string;
  readonly tabUrl: string;
  readonly pageSupported: boolean;
  readonly unsupportedReason: string | null;
  readonly bridgeState: ActiveTabTranslationBridgeState;
  readonly localTranslationState: ActiveTabTranslationLocalState;
  readonly captionDisplayPreferences: CaptionDisplayPreferences;
  readonly captionState: ActiveTabCaptionState;
  readonly generatedCaptionState: ActiveTabGeneratedCaptionState;
  readonly webpageState: ActiveTabWebpageState;
  readonly lastError: string | null;
}

export interface ActiveTabTranslationStatusInput {
  readonly tab: {
    readonly id?: number;
    readonly title?: string;
    readonly url?: string;
  } | null;
  readonly bridgeReady: boolean;
  readonly settings: LocalTranslationSettings;
  readonly captionState?: ActiveTabCaptionState | null;
  readonly generatedCaptionState?: ActiveTabGeneratedCaptionState | null;
  readonly webpageState?: ActiveTabWebpageState | null;
  readonly lastError: string | null;
}

interface RuntimeSenderLike {
  readonly id?: string;
  readonly url?: string;
  readonly tab?: {
    readonly id?: number;
  };
}

const BROWSER_PAGE_PROTOCOLS = new Set(["chrome:", "edge:", "brave:", "about:"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseProgress(value: unknown): TranslationJobProgress | null {
  if (!isRecord(value)) return null;
  if (!isFiniteNumber(value.total)) return null;
  if (!isFiniteNumber(value.completed)) return null;
  if (!isFiniteNumber(value.cacheHits)) return null;
  if (!isFiniteNumber(value.cacheMisses)) return null;
  if (!isFiniteNumber(value.failures)) return null;

  return {
    total: value.total,
    completed: value.completed,
    cacheHits: value.cacheHits,
    cacheMisses: value.cacheMisses,
    failures: value.failures,
  };
}

function parseCaptionState(value: unknown): ActiveTabCaptionState | null {
  if (!isRecord(value)) return null;
  if (
    value.name !== "idle" &&
    value.name !== "detecting" &&
    value.name !== "no-captions" &&
    value.name !== "translating" &&
    value.name !== "rendered" &&
    value.name !== "failed" &&
    value.name !== "cancelled"
  ) {
    return null;
  }
  if (typeof value.message !== "string" || !value.message.trim()) return null;
  if (!isFiniteNumber(value.cueCount) || value.cueCount < 0) return null;
  if (value.trackLabel !== null && typeof value.trackLabel !== "string") return null;
  if (value.progress !== null && parseProgress(value.progress) === null) return null;

  return {
    name: value.name,
    message: value.message.trim(),
    cueCount: value.cueCount,
    trackLabel: typeof value.trackLabel === "string" ? value.trackLabel.trim() || null : null,
    progress: parseProgress(value.progress),
  };
}

function parseGeneratedCaptionState(value: unknown): ActiveTabGeneratedCaptionState | null {
  if (!isRecord(value)) return null;
  if (
    value.name !== "idle" &&
    value.name !== "capturing" &&
    value.name !== "transcribing" &&
    value.name !== "translating" &&
    value.name !== "rendered" &&
    value.name !== "failed" &&
    value.name !== "cancelled"
  ) {
    return null;
  }
  if (typeof value.message !== "string" || !value.message.trim()) return null;
  if (!isFiniteNumber(value.cueCount) || value.cueCount < 0) return null;
  if (value.trackLabel !== null && typeof value.trackLabel !== "string") return null;
  if (value.progress !== null && parseProgress(value.progress) === null) return null;

  return {
    name: value.name,
    message: value.message.trim(),
    cueCount: value.cueCount,
    trackLabel: typeof value.trackLabel === "string" ? value.trackLabel.trim() || null : null,
    progress: parseProgress(value.progress),
  };
}

function parseWebpageState(value: unknown): ActiveTabWebpageState | null {
  if (!isRecord(value)) return null;
  if (
    value.name !== "idle" &&
    value.name !== "collecting" &&
    value.name !== "no-content" &&
    value.name !== "translating" &&
    value.name !== "rendered" &&
    value.name !== "failed" &&
    value.name !== "cancelled"
  ) {
    return null;
  }
  if (typeof value.message !== "string" || !value.message.trim()) return null;
  if (!isFiniteNumber(value.blockCount) || value.blockCount < 0) return null;
  if (!isWebpageDisplayMode(value.displayMode)) return null;
  if (value.progress !== null && parseProgress(value.progress) === null) return null;

  return {
    name: value.name,
    message: value.message.trim(),
    blockCount: value.blockCount,
    displayMode: value.displayMode,
    progress: parseProgress(value.progress),
  };
}

function parseCaptionDisplayPreferences(value: unknown): CaptionDisplayPreferences | null {
  if (!isRecord(value)) return null;
  if (
    value.displayMode !== "inline" &&
    value.displayMode !== "side-by-side" &&
    value.displayMode !== "replace"
  ) {
    return null;
  }
  if (
    value.captionLineOrder !== "original-first" &&
    value.captionLineOrder !== "translated-first"
  ) {
    return null;
  }
  if (
    value.captionFontSize !== "small" &&
    value.captionFontSize !== "medium" &&
    value.captionFontSize !== "large"
  ) {
    return null;
  }
  if (value.captionOverlayPosition !== "top" && value.captionOverlayPosition !== "bottom") {
    return null;
  }
  if (
    !isFiniteNumber(value.captionBackgroundOpacity) ||
    value.captionBackgroundOpacity < 0 ||
    value.captionBackgroundOpacity > 100
  ) {
    return null;
  }
  return {
    displayMode: value.displayMode,
    captionLineOrder: value.captionLineOrder,
    captionFontSize: value.captionFontSize,
    captionOverlayPosition: value.captionOverlayPosition,
    captionBackgroundOpacity: Math.round(value.captionBackgroundOpacity),
  };
}

function parseCaptionCueLike(value: unknown): CaptionCueLike | null {
  if (!isRecord(value)) return null;
  if (typeof value.text !== "string") return null;
  if (!isFiniteNumber(value.startTimeSeconds)) return null;
  if (!isFiniteNumber(value.endTimeSeconds)) return null;
  if (value.endTimeSeconds <= value.startTimeSeconds) return null;

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    text: value.text,
    startTimeSeconds: value.startTimeSeconds,
    endTimeSeconds: value.endTimeSeconds,
    language: isRecord(value.language)
      ? {
          code: typeof value.language.code === "string" ? value.language.code : undefined,
          label: typeof value.language.label === "string" ? value.language.label : undefined,
          autoGenerated:
            typeof value.language.autoGenerated === "boolean"
              ? value.language.autoGenerated
              : undefined,
        }
      : undefined,
    source: isRecord(value.source)
      ? {
          platform: typeof value.source.platform === "string" ? value.source.platform : undefined,
          trackId: typeof value.source.trackId === "string" ? value.source.trackId : undefined,
          cueId: typeof value.source.cueId === "string" ? value.source.cueId : undefined,
        }
      : undefined,
  };
}

function parseCaptionTrackLike(value: unknown): CaptionTrackLike | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.cues)) return null;
  const cues = value.cues.map(parseCaptionCueLike);
  if (cues.some((cue) => cue === null)) return null;

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    label: typeof value.label === "string" ? value.label : undefined,
    language: isRecord(value.language)
      ? {
          code: typeof value.language.code === "string" ? value.language.code : undefined,
          label: typeof value.language.label === "string" ? value.language.label : undefined,
          autoGenerated:
            typeof value.language.autoGenerated === "boolean"
              ? value.language.autoGenerated
              : undefined,
        }
      : undefined,
    source: isRecord(value.source)
      ? {
          platform: typeof value.source.platform === "string" ? value.source.platform : undefined,
          trackId: typeof value.source.trackId === "string" ? value.source.trackId : undefined,
          cueId: typeof value.source.cueId === "string" ? value.source.cueId : undefined,
        }
      : undefined,
    cues: cues.filter((cue): cue is CaptionCueLike => cue !== null),
  };
}

function parseBilingualCaptionCue(value: unknown): BilingualCaptionCue | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.trackId !== "string" || !value.trackId.trim()) return null;
  if (!isFiniteNumber(value.index) || value.index < 0) return null;
  if (typeof value.originalText !== "string") return null;
  if (!isFiniteNumber(value.startTimeSeconds)) return null;
  if (!isFiniteNumber(value.endTimeSeconds)) return null;
  if (value.endTimeSeconds <= value.startTimeSeconds) return null;
  if (value.translatedText !== null && typeof value.translatedText !== "string") return null;
  if (typeof value.displayText !== "string") return null;

  return {
    id: value.id,
    trackId: value.trackId,
    index: value.index,
    originalText: value.originalText,
    startTimeSeconds: value.startTimeSeconds,
    endTimeSeconds: value.endTimeSeconds,
    language: null,
    source: null,
    translatedText: value.translatedText,
    displayText: value.displayText,
  };
}

function parseBilingualCaptionCues(value: unknown): readonly BilingualCaptionCue[] | null {
  if (!Array.isArray(value)) return null;
  const cues = value.map(parseBilingualCaptionCue);
  if (cues.some((cue) => cue === null)) return null;
  return cues.filter((cue): cue is BilingualCaptionCue => cue !== null);
}

function parseWebpageTextBlock(value: unknown): WebpageTextBlock | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (!isFiniteNumber(value.index) || value.index < 0) return null;
  if (typeof value.tagName !== "string" || !value.tagName.trim()) return null;
  if (typeof value.text !== "string" || !value.text.trim()) return null;
  return {
    id: value.id.trim(),
    index: value.index,
    tagName: value.tagName.trim().toLowerCase(),
    text: value.text.trim(),
  };
}

function parseWebpageTextBlocks(value: unknown): readonly WebpageTextBlock[] | null {
  if (!Array.isArray(value)) return null;
  const blocks = value.map(parseWebpageTextBlock);
  if (blocks.some((block) => block === null)) return null;
  return blocks.filter((block): block is WebpageTextBlock => block !== null);
}

function parseTranslatedWebpageBlock(value: unknown): TranslatedWebpageTextBlock | null {
  const block = parseWebpageTextBlock(value);
  if (!block || !isRecord(value)) return null;
  if (value.translatedText !== null && typeof value.translatedText !== "string") return null;
  if (typeof value.displayText !== "string" || !value.displayText.trim()) return null;
  return {
    ...block,
    translatedText: typeof value.translatedText === "string" ? value.translatedText : null,
    displayText: value.displayText,
  };
}

function parseTranslatedWebpageBlocks(
  value: unknown,
): readonly TranslatedWebpageTextBlock[] | null {
  if (!Array.isArray(value)) return null;
  const blocks = value.map(parseTranslatedWebpageBlock);
  if (blocks.some((block) => block === null)) return null;
  return blocks.filter((block): block is TranslatedWebpageTextBlock => block !== null);
}

export function getActiveTabPageSupport(url: string | undefined): ActiveTabPageSupport {
  if (!url) {
    return {
      supported: false,
      reason: "No active page is available for translation.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      supported: false,
      reason: "The active page URL is not available for translation.",
    };
  }

  if (parsed.protocol === "chrome-extension:") {
    return {
      supported: false,
      reason: "Extension pages cannot be translated from the current-page translator.",
    };
  }

  if (BROWSER_PAGE_PROTOCOLS.has(parsed.protocol)) {
    return {
      supported: false,
      reason: "Browser pages do not allow extension translation scripts.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      supported: false,
      reason: "Only http:// and https:// pages can use current-page translation.",
    };
  }

  return { supported: true, reason: null };
}

export function parseControlRequest(value: unknown): ActiveTabTranslationControlRequest | null {
  if (!isRecord(value)) return null;
  if (value.scope !== ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE) return null;

  if (
    value.type === "status" ||
    value.type === "install-bridge" ||
    value.type === "run-caption-translation" ||
    value.type === "cancel-caption-translation" ||
    value.type === "run-generated-caption-translation" ||
    value.type === "cancel-generated-caption-translation" ||
    value.type === "clear-caption-overlay" ||
    value.type === "run-webpage-translation" ||
    value.type === "cancel-webpage-translation" ||
    value.type === "clear-webpage-translation"
  ) {
    return { scope: ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE, type: value.type };
  }

  if (value.type === "set-webpage-display-mode" && isWebpageDisplayMode(value.displayMode)) {
    return {
      scope: ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
      type: "set-webpage-display-mode",
      displayMode: value.displayMode,
    };
  }

  if (value.type === "set-caption-display-preferences") {
    const preferences = parseCaptionDisplayPreferences(value.preferences);
    if (preferences) {
      return {
        scope: ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
        type: "set-caption-display-preferences",
        preferences,
      };
    }
  }

  return null;
}

export function parseBridgeRequest(value: unknown): ActiveTabTranslationBridgeRequest | null {
  if (!isRecord(value)) return null;
  if (value.scope !== ACTIVE_TAB_TRANSLATION_PAGE_SCOPE) return null;

  if (value.type === "collect-caption-track") {
    return {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "collect-caption-track",
      youtubePlayerResponse: value.youtubePlayerResponse,
      selectedBaseUrl:
        typeof value.selectedBaseUrl === "string" ? value.selectedBaseUrl : undefined,
      selectedLabel: typeof value.selectedLabel === "string" ? value.selectedLabel : undefined,
    };
  }

  if (value.type === "clear-caption-overlay") {
    return { scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE, type: "clear-caption-overlay" };
  }

  if (value.type === "show-caption-state") {
    const captionState = parseCaptionState(value.captionState);
    if (captionState) {
      return {
        scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
        type: "show-caption-state",
        captionState,
      };
    }
  }

  if (value.type === "show-generated-caption-state") {
    const generatedCaptionState = parseGeneratedCaptionState(value.generatedCaptionState);
    if (generatedCaptionState) {
      return {
        scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
        type: "show-generated-caption-state",
        generatedCaptionState,
      };
    }
  }

  if (value.type === "render-caption-overlay") {
    const cues = parseBilingualCaptionCues(value.cues);
    const preferences = parseCaptionDisplayPreferences(value.preferences);
    if (cues && preferences) {
      return {
        scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
        type: "render-caption-overlay",
        trackLabel: typeof value.trackLabel === "string" ? value.trackLabel.trim() || null : null,
        cues,
        preferences,
      };
    }
  }

  if (value.type === "set-caption-display-preferences") {
    const preferences = parseCaptionDisplayPreferences(value.preferences);
    if (preferences) {
      return {
        scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
        type: "set-caption-display-preferences",
        preferences,
      };
    }
  }

  if (value.type === "collect-webpage-text") {
    return { scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE, type: "collect-webpage-text" };
  }

  if (value.type === "clear-webpage-translation") {
    return { scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE, type: "clear-webpage-translation" };
  }

  if (value.type === "set-webpage-display-mode" && isWebpageDisplayMode(value.displayMode)) {
    return {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "set-webpage-display-mode",
      displayMode: value.displayMode,
    };
  }

  if (value.type === "show-webpage-state") {
    const webpageState = parseWebpageState(value.webpageState);
    if (webpageState) {
      return {
        scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
        type: "show-webpage-state",
        webpageState,
      };
    }
  }

  if (value.type === "render-webpage-translation" && isWebpageDisplayMode(value.displayMode)) {
    const blocks = parseTranslatedWebpageBlocks(value.blocks);
    if (blocks) {
      return {
        scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
        type: "render-webpage-translation",
        blocks,
        displayMode: value.displayMode,
        targetLanguage:
          typeof value.targetLanguage === "string" && value.targetLanguage.trim()
            ? value.targetLanguage.trim()
            : "ko",
      };
    }
  }

  return null;
}

export function parseCaptionCollectionResponse(
  value: unknown,
): ActiveTabCaptionCollectionResponse | null {
  if (!isRecord(value)) return null;
  if (value.ok === false && value.state === "failed" && typeof value.message === "string") {
    return {
      ok: false,
      state: "failed",
      message: value.message.trim() || "Caption detection failed.",
    };
  }
  if (value.ok !== true) return null;
  if (value.state === "no-captions" && typeof value.message === "string") {
    return {
      ok: true,
      state: "no-captions",
      message: value.message.trim() || "No browser-detectable captions were found.",
    };
  }
  if (value.state === "captions") {
    const track = parseCaptionTrackLike(value.track);
    if (!track || track.cues.length === 0) return null;
    return {
      ok: true,
      state: "captions",
      track,
      currentTimeSeconds:
        typeof value.currentTimeSeconds === "number" && Number.isFinite(value.currentTimeSeconds)
          ? value.currentTimeSeconds
          : null,
    };
  }
  return null;
}

export function parseWebpageCollectionResponse(
  value: unknown,
): ActiveTabWebpageCollectionResponse | null {
  if (!isRecord(value)) return null;
  if (value.ok === false && value.state === "failed" && typeof value.message === "string") {
    return {
      ok: false,
      state: "failed",
      message: value.message.trim() || "Webpage text collection failed.",
    };
  }
  if (value.ok !== true) return null;
  if (value.state === "no-content" && typeof value.message === "string") {
    return {
      ok: true,
      state: "no-content",
      message: value.message.trim() || "No readable webpage text was found.",
    };
  }
  if (value.state === "blocks") {
    const blocks = parseWebpageTextBlocks(value.blocks);
    if (!blocks || blocks.length === 0) return null;
    return { ok: true, state: "blocks", blocks };
  }
  return null;
}

export function isTrustedControlSender(sender: RuntimeSenderLike, extensionId: string): boolean {
  const extensionUrl = `chrome-extension://${extensionId}/`;
  const senderIdTrusted = sender.id === undefined || sender.id === extensionId;
  if (!senderIdTrusted) return false;
  if (sender.url !== undefined) return sender.url.startsWith(extensionUrl);
  return sender.tab?.id === undefined;
}

export function isTrustedBridgeSender(sender: RuntimeSenderLike, extensionId: string): boolean {
  return sender.id === extensionId && typeof sender.tab?.id === "number";
}

export function isTrustedContentSender(sender: RuntimeSenderLike, extensionId: string): boolean {
  return sender.id === extensionId && typeof sender.tab?.id === "number";
}

export function buildActiveTabTranslationStatus(
  input: ActiveTabTranslationStatusInput,
): ActiveTabTranslationStatus {
  const pageSupport = getActiveTabPageSupport(input.tab?.url);
  const bridgeState = pageSupport.supported
    ? input.bridgeReady
      ? "ready"
      : "available"
    : "unsupported";

  return {
    tabId: input.tab?.id ?? null,
    tabTitle: input.tab?.title?.trim() || "Untitled tab",
    tabUrl: input.tab?.url ?? "",
    pageSupported: pageSupport.supported,
    unsupportedReason: pageSupport.reason,
    bridgeState,
    localTranslationState: input.settings.enabled ? "enabled" : "disabled",
    captionDisplayPreferences: captionDisplayPreferencesFromSettings(input.settings),
    captionState: input.captionState ?? ACTIVE_TAB_CAPTION_IDLE_STATE,
    generatedCaptionState: input.generatedCaptionState ?? ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE,
    webpageState: input.webpageState ?? ACTIVE_TAB_WEBPAGE_IDLE_STATE,
    lastError: input.lastError,
  };
}
