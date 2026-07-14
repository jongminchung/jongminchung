export const INJECTED_TRANSLATION_UI_EVENT = "tobi-immersive-translate:ui-state";

export type InjectedFloatingStatus = "inactive" | "running" | "active" | "error";

export interface InjectedFloatingState {
  readonly status: InjectedFloatingStatus;
  readonly active: boolean;
  readonly message: string;
}

export interface InjectedCaptionLine {
  readonly kind: "original" | "translated";
  readonly text: string;
}

export interface InjectedCaptionPlacement {
  readonly left: number;
  readonly width: number;
  readonly top: number | null;
  readonly bottom: number | null;
}

export interface InjectedCaptionCue {
  readonly id: string;
  readonly lines: readonly InjectedCaptionLine[];
  readonly placement: InjectedCaptionPlacement;
  readonly fontSize: number;
  readonly backgroundOpacity: number;
}

export type InjectedTranslationUiEvent =
  | {
      readonly version: 1;
      readonly type: "floating";
      readonly state: InjectedFloatingState;
    }
  | {
      readonly version: 1;
      readonly type: "caption-status";
      readonly message: string;
    }
  | {
      readonly version: 1;
      readonly type: "caption-cue";
      readonly message: string;
      readonly cue: InjectedCaptionCue;
    }
  | {
      readonly version: 1;
      readonly type: "caption-clear";
      readonly message: string;
    };

export interface InjectedTranslationUiState {
  readonly floating: InjectedFloatingState;
  readonly captionMessage: string;
  readonly captionCue: InjectedCaptionCue | null;
}

export interface InjectedTranslationUiStore {
  readonly getSnapshot: () => InjectedTranslationUiState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly receive: (event: InjectedTranslationUiEvent) => void;
  readonly setFloating: (state: InjectedFloatingState) => void;
}

const initialState: InjectedTranslationUiState = {
  floating: {
    status: "inactive",
    active: false,
    message: "페이지 번역 준비됨",
  },
  captionMessage: "",
  captionCue: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFloatingStatus(value: unknown): value is InjectedFloatingStatus {
  return value === "inactive" || value === "running" || value === "active" || value === "error";
}

function parseFloatingState(value: unknown): InjectedFloatingState | null {
  if (!isRecord(value) || !isFloatingStatus(value.status)) return null;
  if (typeof value.active !== "boolean" || typeof value.message !== "string") return null;
  return { status: value.status, active: value.active, message: value.message };
}

function parseCaptionLines(value: unknown): readonly InjectedCaptionLine[] | null {
  if (!Array.isArray(value)) return null;
  const lines: InjectedCaptionLine[] = [];
  for (const line of value) {
    if (!isRecord(line)) return null;
    if (line.kind !== "original" && line.kind !== "translated") return null;
    if (typeof line.text !== "string") return null;
    lines.push({ kind: line.kind, text: line.text });
  }
  return lines;
}

function parseCaptionPlacement(value: unknown): InjectedCaptionPlacement | null {
  if (!isRecord(value)) return null;
  if (typeof value.left !== "number" || typeof value.width !== "number") return null;
  if (value.top !== null && typeof value.top !== "number") return null;
  if (value.bottom !== null && typeof value.bottom !== "number") return null;
  return { left: value.left, width: value.width, top: value.top, bottom: value.bottom };
}

function parseCaptionCue(value: unknown): InjectedCaptionCue | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const lines = parseCaptionLines(value.lines);
  const placement = parseCaptionPlacement(value.placement);
  if (!lines || !placement) return null;
  if (typeof value.fontSize !== "number" || typeof value.backgroundOpacity !== "number") {
    return null;
  }
  return {
    id: value.id,
    lines,
    placement,
    fontSize: value.fontSize,
    backgroundOpacity: value.backgroundOpacity,
  };
}

export function parseInjectedTranslationUiEvent(value: unknown): InjectedTranslationUiEvent | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.type !== "string") return null;
  if (parsed.type === "floating") {
    const state = parseFloatingState(parsed.state);
    return state ? { version: 1, type: "floating", state } : null;
  }
  if (parsed.type === "caption-status" || parsed.type === "caption-clear") {
    if (typeof parsed.message !== "string") return null;
    return { version: 1, type: parsed.type, message: parsed.message };
  }
  if (parsed.type === "caption-cue") {
    const cue = parseCaptionCue(parsed.cue);
    if (!cue || typeof parsed.message !== "string") return null;
    return { version: 1, type: "caption-cue", message: parsed.message, cue };
  }
  return null;
}

export function createInjectedTranslationUiStore(): InjectedTranslationUiStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  const publish = (nextState: InjectedTranslationUiState): void => {
    state = nextState;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    receive: (event) => {
      if (event.type === "floating") {
        publish({ ...state, floating: event.state });
        return;
      }
      if (event.type === "caption-cue") {
        publish({ ...state, captionMessage: event.message, captionCue: event.cue });
        return;
      }
      publish({
        ...state,
        captionMessage: event.message,
        captionCue: event.type === "caption-clear" ? null : state.captionCue,
      });
    },
    setFloating: (floating) => publish({ ...state, floating }),
  };
}
