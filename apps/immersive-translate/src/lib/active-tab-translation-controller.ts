import { browser } from "wxt/browser";
import {
  ACTIVE_TAB_CAPTION_IDLE_STATE,
  ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE,
  ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
  ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
  ACTIVE_TAB_WEBPAGE_IDLE_STATE,
  type ActiveTabCaptionState,
  type ActiveTabCaptionCollectionResponse,
  type ActiveTabGeneratedCaptionState,
  type ActiveTabTranslationControlRequest,
  type ActiveTabTranslationStatus,
  type ActiveTabWebpageState,
  buildActiveTabTranslationStatus,
  getActiveTabPageSupport,
  parseCaptionCollectionResponse,
  parseWebpageCollectionResponse,
} from "./active-tab-translation";
import { ActiveTabTranslationStateStore } from "./active-tab-translation-state-store";
import {
  composeBilingualCaptionCues,
  mapCaptionTrack,
  type CaptionCue,
  type CaptionTrack,
  type CaptionTrackLike,
  runCaptionTranslationPipeline,
} from "./caption-translation";
import {
  planCaptionTranslationInputs,
  selectCaptionPrefetchWindow,
} from "./caption-priority-translation";
import { fetchGeneratedCaptionTrack, GeneratedCaptionError } from "./generated-captions";
import {
  installTranslationBridgeInPage,
  readYouTubePlayerResponseInMainWorld,
} from "./injected-translation-bridge";
import {
  type CaptionDisplayPreferences,
  captionDisplayPreferencesFromSettings,
  DEFAULT_LOCAL_TRANSLATION_SETTINGS,
  isBidirectionalKoEnTargetLanguage,
  LocalTranslationRepository,
  LocalTranslationService,
  type LocalTranslationError,
  type LocalTranslationSettings,
  type TranslationInput,
  type TranslationJobProgress,
  type TranslationJobResult,
  type TranslationOutput,
} from "./local-translation";
import {
  buildWebpageTranslationInputs,
  composeTranslatedWebpageBlocks,
  type WebpageDisplayMode,
} from "./webpage-translation";
import { preferredYouTubeCaptionLanguageCodes } from "./youtube-captions";
import { youtubeVideoIdFromUrl } from "./youtube-url";

interface BrowserTab {
  readonly id?: number;
  readonly title?: string;
  readonly url?: string;
}

export interface ActiveTabTranslationRequestContext {
  readonly tabId?: number;
}

const localTranslationRepository = LocalTranslationRepository.ofStorage(browser.storage.local);
const stateStore = ActiveTabTranslationStateStore.create();
const CAPTION_TRANSLATION_BATCH_SIZE = 4;
const INITIAL_CAPTION_TRANSLATION_BATCH_SIZE = 3;
const BACKGROUND_CAPTION_TRANSLATION_BATCH_SIZE = 8;
const CAPTION_PREFETCH_LOOKAHEAD_SECONDS = 60;
const CAPTION_PREFETCH_MINIMUM_CUE_COUNT = 20;
const PAGE_CAPTION_COLLECTION_TIMEOUT_MS = 4_000;
const LOCAL_TRANSLATION_WARMUP_TIMEOUT_MS = 4_000;
const LOCAL_TRANSLATION_WARMUP_TTL_MS = 10 * 60_000;
const localTranslationWarmups = new Map<string, number>();
const captionSessionsByTabId = new Map<number, CaptionTranslationSession>();

interface YouTubePlayerSnapshot {
  readonly playerResponse: unknown;
  readonly selectedBaseUrl?: string;
  readonly selectedLabel?: string;
  readonly selectedLanguageCode?: string;
  readonly videoTitle?: string;
}

type CaptionCollectionCandidate =
  | {
      readonly source: "page";
      readonly collection: ActiveTabCaptionCollectionResponse | null;
    }
  | {
      readonly source: "background";
      readonly track: CaptionTrackLike | null;
    };

interface CaptionTranslationSession {
  readonly key: string;
  readonly tabId: number;
  readonly controller: AbortController;
  readonly track: CaptionTrack;
  readonly trackLabel: string;
  readonly translationsByCueId: Map<string, string>;
  readonly pendingCueIds: Set<string>;
  readonly failedCueIds: Set<string>;
  readonly errors: LocalTranslationError[];
  bufferCueIds: readonly string[];
  fillPromise: Promise<void> | null;
  queuedFillRequest: { readonly currentTimeSeconds: number | null } | null;
  cacheHits: number;
  cacheMisses: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstFailureMessage(
  errors: readonly LocalTranslationError[],
  fallback: string,
): string {
  const firstMessage = errors.find((error) => error.message.trim())?.message.trim();
  return firstMessage ? `로컬 번역 실패: ${firstMessage}` : fallback;
}

async function readResponseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) return response.statusText || "요청 실패";
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed) && typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
    if (isRecord(parsed) && typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    return text.trim();
  }
  return text.trim();
}

function youtubeCaptionEndpointFromTranslationEndpoint(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    url.pathname = "/youtube-captions";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function settingsForCaptionTranslation(
  settings: LocalTranslationSettings,
): LocalTranslationSettings {
  return {
    ...settings,
    batchSize: Math.min(settings.batchSize, CAPTION_TRANSLATION_BATCH_SIZE),
  };
}

async function warmLocalTranslationEndpoint(settings: LocalTranslationSettings): Promise<void> {
  if (!settings.enabled) return;
  const endpoint = youtubeCaptionEndpointFromTranslationEndpoint(settings.endpoint);
  if (!endpoint) return;
  const url = new URL(endpoint);
  url.pathname = "/health";
  url.search = "";
  const key = JSON.stringify({
    endpoint: url.toString(),
  });
  const now = Date.now();
  const warmedUntil = localTranslationWarmups.get(key) ?? 0;
  if (warmedUntil > now) return;
  localTranslationWarmups.set(key, now + 30_000);

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    LOCAL_TRANSLATION_WARMUP_TIMEOUT_MS,
  );
  try {
    const result = await fetch(url.toString(), { signal: controller.signal });
    localTranslationWarmups.set(
      key,
      now + (result.ok ? LOCAL_TRANSLATION_WARMUP_TTL_MS : 60_000),
    );
  } catch {
    localTranslationWarmups.set(key, now + 60_000);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T | null> {
  return await Promise.race([
    request,
    new Promise<null>((resolve) => globalThis.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function findActiveTargetTab(
  context: ActiveTabTranslationRequestContext = {},
): Promise<BrowserTab | null> {
  if (typeof context.tabId === "number") {
    try {
      return await browser.tabs.get(context.tabId);
    } catch {
      return null;
    }
  }

  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTab && getActiveTabPageSupport(activeTab.url).supported) return activeTab;

  const currentWindowTabs = await browser.tabs.query({ currentWindow: true });
  return (
    currentWindowTabs.find((tab) => getActiveTabPageSupport(tab.url).supported) ?? activeTab ?? null
  );
}

async function readStatus(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const tab = await findActiveTargetTab(context);
  const settings = await localTranslationRepository.load();
  const tabId = tab?.id;
  return buildActiveTabTranslationStatus({
    tab,
    bridgeReady: typeof tabId === "number" && stateStore.isBridgeReady(tabId),
    settings,
    captionState:
      typeof tabId === "number"
        ? (stateStore.getCaptionState(tabId) ?? ACTIVE_TAB_CAPTION_IDLE_STATE)
        : ACTIVE_TAB_CAPTION_IDLE_STATE,
    generatedCaptionState:
      typeof tabId === "number"
        ? (stateStore.getGeneratedCaptionState(tabId) ?? ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE)
        : ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE,
    webpageState:
      typeof tabId === "number"
        ? (stateStore.getWebpageState(tabId) ?? ACTIVE_TAB_WEBPAGE_IDLE_STATE)
        : ACTIVE_TAB_WEBPAGE_IDLE_STATE,
    lastError: typeof tabId === "number" ? stateStore.getLastError(tabId) : null,
  });
}

function readOptionalNonEmptyString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseYouTubePlayerSnapshot(value: unknown): YouTubePlayerSnapshot {
  if (!isRecord(value)) return { playerResponse: value };
  const hasSnapshotShape =
    "playerResponse" in value ||
    "selectedBaseUrl" in value ||
    "selectedLabel" in value ||
    "selectedLanguageCode" in value ||
    "videoTitle" in value;
  if (!hasSnapshotShape) return { playerResponse: value };
  return {
    playerResponse: value.playerResponse,
    selectedBaseUrl: readOptionalNonEmptyString(value, "selectedBaseUrl"),
    selectedLabel: readOptionalNonEmptyString(value, "selectedLabel"),
    selectedLanguageCode: readOptionalNonEmptyString(value, "selectedLanguageCode"),
    videoTitle: readOptionalNonEmptyString(value, "videoTitle"),
  };
}

async function readYouTubePlayerSnapshot(tabId: number): Promise<YouTubePlayerSnapshot> {
  try {
    const request = browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readYouTubePlayerResponseInMainWorld,
    });
    const results = await withTimeout(request, 2_500);
    const [result] = results ?? [];
    return parseYouTubePlayerSnapshot(result?.result ?? null);
  } catch (error) {
    return {
      playerResponse: {
        error: error instanceof Error ? error.message : "Could not read player data.",
      },
    };
  }
}

function readVideoCurrentTimeInPage(): number | null {
  const video = document.querySelector("video");
  const currentTimeSeconds = video?.currentTime;
  return typeof currentTimeSeconds === "number" && Number.isFinite(currentTimeSeconds)
    ? currentTimeSeconds
    : null;
}

async function readPageVideoCurrentTime(tabId: number): Promise<number | null> {
  try {
    const request = browser.scripting.executeScript({
      target: { tabId },
      func: readVideoCurrentTimeInPage,
    });
    const results = await withTimeout(request, 1_500);
    const [result] = results ?? [];
    return typeof result?.result === "number" && Number.isFinite(result.result)
      ? result.result
      : null;
  } catch {
    return null;
  }
}

function textFromYouTubeJson3Segments(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((segment) => (isRecord(segment) && typeof segment.utf8 === "string" ? segment.utf8 : ""))
    .join("")
    .trim();
}

function parseYouTubeJson3CaptionTrack(input: {
  readonly payload: string;
  readonly videoId: string;
  readonly languageCode: string;
  readonly label: string;
}): CaptionTrackLike | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.payload);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.events)) return null;
  const trackId = `youtube:${input.videoId}:${input.languageCode}`;
  const language = {
    code: input.languageCode,
    label: input.label,
    autoGenerated: true,
  };
  const cues = parsed.events
    .map((event) => {
      if (!isRecord(event)) return null;
      if (typeof event.tStartMs !== "number" || !Number.isFinite(event.tStartMs)) return null;
      if (
        typeof event.dDurationMs !== "number" ||
        !Number.isFinite(event.dDurationMs) ||
        event.dDurationMs <= 0
      ) {
        return null;
      }
      const text = textFromYouTubeJson3Segments(event.segs);
      if (!text) return null;
      return {
        text,
        startTimeSeconds: event.tStartMs / 1000,
        endTimeSeconds: (event.tStartMs + event.dDurationMs) / 1000,
        language,
      };
    })
    .filter((cue) => cue !== null)
    .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds)
    .map((cue, index) => ({
      ...cue,
      id: `${trackId}:${index}`,
      source: { platform: "youtube", trackId, cueId: `${trackId}:${index}` },
    }));
  if (cues.length === 0) return null;
  return {
    id: trackId,
    label: input.label,
    language,
    source: { platform: "youtube", trackId },
    cues,
  };
}

async function fetchBackgroundYouTubeCaptionTrack(input: {
  readonly settingsEndpoint: string;
  readonly tabUrl?: string;
  readonly languageCode: string;
}): Promise<CaptionTrackLike | null> {
  const endpoint = youtubeCaptionEndpointFromTranslationEndpoint(input.settingsEndpoint);
  const videoId = youtubeVideoIdFromUrl(input.tabUrl);
  if (!endpoint || !videoId) return null;
  const url = new URL(endpoint);
  url.searchParams.set("videoId", videoId);
  url.searchParams.set("languageCode", input.languageCode);
  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 404) return null;
    const detail = await readResponseErrorMessage(response);
    throw new Error(`로컬 자막 수집 서비스 오류 (${response.status}): ${detail}`);
  }
  const parsed: unknown = await response.json();
  if (!isRecord(parsed) || typeof parsed.payload !== "string") return null;
  const languageCode =
    typeof parsed.languageCode === "string" && parsed.languageCode.trim()
      ? parsed.languageCode.trim()
      : input.languageCode;
  const label =
    typeof parsed.label === "string" && parsed.label.trim()
      ? parsed.label.trim()
      : `YouTube ${languageCode} captions`;
  return parseYouTubeJson3CaptionTrack({
    payload: parsed.payload,
    videoId,
    languageCode,
    label,
  });
}

async function collectBackgroundYouTubeCaptionTrack(input: {
  readonly settingsEndpoint: string;
  readonly tabUrl?: string;
  readonly selectedLanguageCode?: string;
  readonly selectedLabel?: string;
  readonly videoTitle?: string;
}): Promise<CaptionTrackLike | null> {
  const languageCodes = preferredYouTubeCaptionLanguageCodes({
    selectedLanguageCode: input.selectedLanguageCode,
    selectedLabel: input.selectedLabel,
    videoTitle: input.videoTitle,
  });
  for (const languageCode of languageCodes) {
    const track = await fetchBackgroundYouTubeCaptionTrack({ ...input, languageCode });
    if (track) return track;
  }
  return null;
}

function captionCollectionFromBackgroundTrack(input: {
  readonly track: CaptionTrackLike;
  readonly currentTimeSeconds: number | null;
}): ActiveTabCaptionCollectionResponse {
  return {
    ok: true,
    state: "captions",
    track: input.track,
    currentTimeSeconds: input.currentTimeSeconds ?? 0,
  };
}

async function resolveCaptionCollection(input: {
  readonly pageCollectionPromise: Promise<ActiveTabCaptionCollectionResponse | null>;
  readonly backgroundTrackPromise: Promise<CaptionTrackLike | null>;
  readonly backgroundCurrentTimePromise: Promise<number | null>;
}): Promise<ActiveTabCaptionCollectionResponse | null> {
  const first = await Promise.race<CaptionCollectionCandidate>([
    input.pageCollectionPromise.then((collection) => ({ source: "page", collection })),
    input.backgroundTrackPromise.then((track) => ({ source: "background", track })),
  ]);

  if (first.source === "page" && first.collection?.state === "captions") {
    return first.collection;
  }
  if (first.source === "background" && first.track) {
    return captionCollectionFromBackgroundTrack({
      track: first.track,
      currentTimeSeconds: await input.backgroundCurrentTimePromise,
    });
  }

  const [pageCollection, backgroundTrack] = await Promise.all([
    input.pageCollectionPromise,
    input.backgroundTrackPromise,
  ]);
  if (pageCollection?.state === "captions") return pageCollection;
  if (backgroundTrack) {
    return captionCollectionFromBackgroundTrack({
      track: backgroundTrack,
      currentTimeSeconds: await input.backgroundCurrentTimePromise,
    });
  }
  return pageCollection;
}

async function installBridge(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const tab = await findActiveTargetTab(context);
  const tabId = tab?.id;
  const support = getActiveTabPageSupport(tab?.url);
  if (!support.supported || typeof tabId !== "number") {
    if (typeof tabId === "number" && support.reason) stateStore.setLastError(tabId, support.reason);
    return readStatus(context);
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: installTranslationBridgeInPage,
      args: [ACTIVE_TAB_TRANSLATION_PAGE_SCOPE, ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE],
    });
    stateStore.markBridgeReady(tabId);
    stateStore.clearLastError(tabId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not install bridge.";
    stateStore.setLastError(tabId, message);
  }

  return readStatus(context);
}

async function sendPageMessage(tabId: number, message: unknown): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, message);
}

function buildCaptionState(input: {
  readonly name: ActiveTabCaptionState["name"];
  readonly message: string;
  readonly cueCount?: number;
  readonly trackLabel?: string | null;
  readonly progress?: TranslationJobProgress | null;
}): ActiveTabCaptionState {
  return {
    name: input.name,
    message: input.message,
    cueCount: input.cueCount ?? 0,
    trackLabel: input.trackLabel ?? null,
    progress: input.progress ?? null,
  };
}

function buildGeneratedCaptionState(input: {
  readonly name: ActiveTabGeneratedCaptionState["name"];
  readonly message: string;
  readonly cueCount?: number;
  readonly trackLabel?: string | null;
  readonly progress?: TranslationJobProgress | null;
}): ActiveTabGeneratedCaptionState {
  return {
    name: input.name,
    message: input.message,
    cueCount: input.cueCount ?? 0,
    trackLabel: input.trackLabel ?? null,
    progress: input.progress ?? null,
  };
}

function parseRenderCaptionOverlayResponse(value: unknown): {
  readonly ok: boolean;
  readonly message: string | null;
  readonly renderedCueCount: number;
  readonly translatedCueCount: number;
} {
  if (!isRecord(value)) {
    return {
      ok: false,
      message: "자막 번역을 표시하지 못했습니다.",
      renderedCueCount: 0,
      translatedCueCount: 0,
    };
  }
  const renderedCueCount =
    typeof value.renderedCueCount === "number" && Number.isFinite(value.renderedCueCount)
      ? value.renderedCueCount
      : 0;
  const translatedCueCount =
    typeof value.translatedCueCount === "number" && Number.isFinite(value.translatedCueCount)
      ? value.translatedCueCount
      : 0;
  return {
    ok: value.ok === true,
    message:
      typeof value.message === "string" && value.message.trim() ? value.message.trim() : null,
    renderedCueCount,
    translatedCueCount,
  };
}

function splitTranslationInputs(
  inputs: readonly TranslationInput[],
  batchSize: number,
): readonly (readonly TranslationInput[])[] {
  const chunks: TranslationInput[][] = [];
  const safeBatchSize = Math.max(1, Math.round(batchSize));
  for (let index = 0; index < inputs.length; index += safeBatchSize) {
    chunks.push(inputs.slice(index, index + safeBatchSize));
  }
  return chunks;
}

function captionSessionKey(input: {
  readonly tabId: number;
  readonly tabUrl: string | null;
  readonly track: CaptionTrack;
}): string {
  const videoIdentity =
    youtubeVideoIdFromUrl(input.tabUrl ?? undefined) ??
    input.track.source?.trackId ??
    input.tabUrl ??
    "unknown";
  const trackIdentity = input.track.source?.trackId ?? input.track.id;
  return `${input.tabId}:${videoIdentity}:${trackIdentity}`;
}

function clearCaptionSession(tabId: number): void {
  const session = captionSessionsByTabId.get(tabId);
  if (session && !session.controller.signal.aborted) session.controller.abort();
  captionSessionsByTabId.delete(tabId);
  stateStore.abortCaptionController(tabId);
}

function createCaptionSession(input: {
  readonly tabId: number;
  readonly tabUrl: string | null;
  readonly track: CaptionTrack;
  readonly trackLabel: string;
}): CaptionTranslationSession {
  const key = captionSessionKey(input);
  const currentSession = captionSessionsByTabId.get(input.tabId);
  if (
    currentSession &&
    currentSession.key === key &&
    !currentSession.controller.signal.aborted
  ) {
    return currentSession;
  }

  clearCaptionSession(input.tabId);
  const controller = new AbortController();
  const session: CaptionTranslationSession = {
    key,
    tabId: input.tabId,
    controller,
    track: input.track,
    trackLabel: input.trackLabel,
    translationsByCueId: new Map(),
    pendingCueIds: new Set(),
    failedCueIds: new Set(),
    errors: [],
    bufferCueIds: [],
    fillPromise: null,
    queuedFillRequest: null,
    cacheHits: 0,
    cacheMisses: 0,
  };
  captionSessionsByTabId.set(input.tabId, session);
  stateStore.setCaptionController(input.tabId, controller);
  return session;
}

function isCaptionSessionActive(session: CaptionTranslationSession): boolean {
  return (
    captionSessionsByTabId.get(session.tabId) === session && !session.controller.signal.aborted
  );
}

function translatedOutputsForCues(
  session: CaptionTranslationSession,
  cues: readonly CaptionCue[],
): readonly TranslationOutput[] {
  return cues.flatMap((cue): TranslationOutput[] => {
    const text = session.translationsByCueId.get(cue.id);
    return text === undefined ? [] : [{ id: cue.id, text }];
  });
}

function captionSessionProgress(
  session: CaptionTranslationSession,
  cues: readonly CaptionCue[],
): TranslationJobProgress {
  const cueIds = new Set(cues.map((cue) => cue.id));
  const completed = cues.filter((cue) => session.translationsByCueId.has(cue.id)).length;
  const failures = [...session.failedCueIds].filter((cueId) => cueIds.has(cueId)).length;
  return {
    total: cues.length,
    completed,
    cacheHits: session.cacheHits,
    cacheMisses: session.cacheMisses,
    failures,
  };
}

function captionSessionState(input: {
  readonly progress: TranslationJobProgress;
  readonly pendingCount: number;
  readonly errors: readonly LocalTranslationError[];
}): Pick<ActiveTabCaptionState, "name" | "message"> {
  if (
    input.progress.total > 0 &&
    input.pendingCount === 0 &&
    input.progress.completed === 0 &&
    input.progress.failures >= input.progress.total
  ) {
    return {
      name: "failed",
      message: firstFailureMessage(input.errors, "자막 번역에 실패해 원문 자막을 표시합니다."),
    };
  }
  if (
    input.progress.total > 0 &&
    input.pendingCount === 0 &&
    input.progress.completed + input.progress.failures >= input.progress.total
  ) {
    return {
      name: "rendered",
      message:
        input.progress.failures > 0
          ? "일부 자막은 원문으로 표시됩니다."
          : "자막 번역이 표시되었습니다.",
    };
  }
  return {
    name: "translating",
    message: "자막 번역 버퍼를 준비하는 중...",
  };
}

async function publishCaptionSessionSnapshot(input: {
  readonly session: CaptionTranslationSession;
  readonly settings: LocalTranslationSettings;
  readonly cues: readonly CaptionCue[];
}): Promise<void> {
  if (!isCaptionSessionActive(input.session)) return;
  const displayCues = composeBilingualCaptionCues(
    input.cues,
    translatedOutputsForCues(input.session, input.cues),
  );
  const renderResponse = parseRenderCaptionOverlayResponse(
    await sendPageMessage(input.session.tabId, {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "render-caption-overlay",
      trackLabel: input.session.trackLabel,
      cues: displayCues,
      preferences: captionDisplayPreferencesFromSettings(input.settings),
    }),
  );
  if (!renderResponse.ok || renderResponse.renderedCueCount === 0) {
    throw new Error(renderResponse.message ?? "자막 번역을 표시하지 못했습니다.");
  }

  const progress = captionSessionProgress(input.session, input.cues);
  const cueIds = new Set(input.cues.map((cue) => cue.id));
  const pendingCount = [...input.session.pendingCueIds].filter((cueId) =>
    cueIds.has(cueId),
  ).length;
  const state = captionSessionState({
    progress,
    pendingCount,
    errors: input.session.errors,
  });
  rememberProgress(
    input.session.tabId,
    buildCaptionState({
      name: state.name,
      message: state.message,
      cueCount: displayCues.length,
      trackLabel: input.session.trackLabel,
      progress,
    }),
  );
  if (state.name === "failed") {
    stateStore.setLastError(input.session.tabId, state.message);
  } else if (input.session.errors.length === 0) {
    stateStore.clearLastError(input.session.tabId);
  }
}

function applyCaptionSessionResult(
  session: CaptionTranslationSession,
  result: TranslationJobResult,
): void {
  for (const translation of result.translations) {
    session.translationsByCueId.set(translation.id, translation.text);
    session.failedCueIds.delete(translation.id);
  }
  for (const error of result.errors) {
    session.errors.push(error);
    for (const inputId of error.inputIds) {
      session.failedCueIds.add(inputId);
    }
  }
  session.cacheHits += result.progress.cacheHits;
  session.cacheMisses += result.progress.cacheMisses;
}

async function translateCaptionSessionChunks(input: {
  readonly session: CaptionTranslationSession;
  readonly settings: LocalTranslationSettings;
  readonly chunks: readonly (readonly TranslationInput[])[];
  readonly bufferCues: readonly CaptionCue[];
}): Promise<void> {
  for (const chunk of input.chunks) {
    if (chunk.length === 0) continue;
    if (!isCaptionSessionActive(input.session)) return;

    try {
      const result = await LocalTranslationService.runJob(
        { ...settingsForCaptionTranslation(input.settings), batchSize: chunk.length },
        chunk,
        {
          repository: localTranslationRepository,
          signal: input.session.controller.signal,
        },
      );
      applyCaptionSessionResult(input.session, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "영상 자막 번역에 실패했습니다.";
      input.session.errors.push({
        code: "offline_endpoint",
        message,
        inputIds: chunk.map((item) => item.id),
      });
      for (const item of chunk) input.session.failedCueIds.add(item.id);
      stateStore.setLastError(input.session.tabId, message);
    } finally {
      for (const item of chunk) input.session.pendingCueIds.delete(item.id);
    }

    await publishCaptionSessionSnapshot({
      session: input.session,
      settings: input.settings,
      cues: input.bufferCues,
    });
  }
}

async function fillCaptionSessionBuffer(input: {
  readonly session: CaptionTranslationSession;
  readonly settings: LocalTranslationSettings;
  readonly currentTimeSeconds: number | null;
}): Promise<void> {
  const prefetchWindow = selectCaptionPrefetchWindow(input.session.track, {
    currentTimeSeconds: input.currentTimeSeconds,
    lookAheadSeconds: CAPTION_PREFETCH_LOOKAHEAD_SECONDS,
    minimumCueCount: CAPTION_PREFETCH_MINIMUM_CUE_COUNT,
  });
  input.session.bufferCueIds = prefetchWindow.cues.map((cue) => cue.id);
  await publishCaptionSessionSnapshot({
    session: input.session,
    settings: input.settings,
    cues: prefetchWindow.cues,
  });

  const plan = planCaptionTranslationInputs(prefetchWindow.cues, input.currentTimeSeconds, {
    translatedCueIds: new Set(input.session.translationsByCueId.keys()),
    pendingCueIds: input.session.pendingCueIds,
    highPriorityCueCount: INITIAL_CAPTION_TRANSLATION_BATCH_SIZE,
  });
  for (const item of plan.orderedInputs) input.session.pendingCueIds.add(item.id);
  if (plan.orderedInputs.length === 0) {
    await publishCaptionSessionSnapshot({
      session: input.session,
      settings: input.settings,
      cues: prefetchWindow.cues,
    });
    return;
  }

  await publishCaptionSessionSnapshot({
    session: input.session,
    settings: input.settings,
    cues: prefetchWindow.cues,
  });

  await translateCaptionSessionChunks({
    session: input.session,
    settings: input.settings,
    bufferCues: prefetchWindow.cues,
    chunks: [
      ...splitTranslationInputs(
        plan.highPriorityInputs,
        INITIAL_CAPTION_TRANSLATION_BATCH_SIZE,
      ),
      ...splitTranslationInputs(plan.backgroundInputs, BACKGROUND_CAPTION_TRANSLATION_BATCH_SIZE),
    ],
  });
}

function startCaptionSessionFill(input: {
  readonly session: CaptionTranslationSession;
  readonly settings: LocalTranslationSettings;
  readonly currentTimeSeconds: number | null;
}): void {
  if (input.session.fillPromise) {
    input.session.queuedFillRequest = { currentTimeSeconds: input.currentTimeSeconds };
    return;
  }
  const fillPromise = fillCaptionSessionBuffer(input)
    .catch((error: unknown) => {
      if (!isCaptionSessionActive(input.session)) return;
      const message = error instanceof Error ? error.message : "영상 자막 번역에 실패했습니다.";
      stateStore.setLastError(input.session.tabId, message);
      rememberProgress(
        input.session.tabId,
        buildCaptionState({
          name: "failed",
          message,
          cueCount: input.session.bufferCueIds.length,
          trackLabel: input.session.trackLabel,
          progress: stateStore.getCaptionState(input.session.tabId)?.progress ?? null,
        }),
      );
    })
    .finally(() => {
      if (input.session.fillPromise !== fillPromise) return;
      input.session.fillPromise = null;
      const queuedFillRequest = input.session.queuedFillRequest;
      input.session.queuedFillRequest = null;
      if (queuedFillRequest && isCaptionSessionActive(input.session)) {
        startCaptionSessionFill({
          session: input.session,
          settings: input.settings,
          currentTimeSeconds: queuedFillRequest.currentTimeSeconds,
        });
      }
    });
  input.session.fillPromise = fillPromise;
}

async function updateCaptionState(tabId: number, state: ActiveTabCaptionState): Promise<void> {
  stateStore.setCaptionState(tabId, state);
  await sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "show-caption-state",
    captionState: state,
  });
}

function rememberProgress(tabId: number, state: ActiveTabCaptionState): void {
  stateStore.setCaptionState(tabId, state);
  void sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "show-caption-state",
    captionState: state,
  }).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "자막 번역 상태를 업데이트하지 못했습니다.";
    stateStore.setLastError(tabId, message);
  });
}

async function updateGeneratedCaptionState(
  tabId: number,
  state: ActiveTabGeneratedCaptionState,
): Promise<void> {
  stateStore.setGeneratedCaptionState(tabId, state);
  await sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "show-generated-caption-state",
    generatedCaptionState: state,
  });
}

function rememberGeneratedCaptionProgress(
  tabId: number,
  state: ActiveTabGeneratedCaptionState,
): void {
  stateStore.setGeneratedCaptionState(tabId, state);
  void sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "show-generated-caption-state",
    generatedCaptionState: state,
  }).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "생성 자막 상태를 업데이트하지 못했습니다.";
    stateStore.setLastError(tabId, message);
  });
}

async function runCaptionTranslation(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await installBridge(context);
  if (!status.pageSupported || status.bridgeState !== "ready" || status.tabId === null)
    return status;
  const tabId = status.tabId;

  const settings = await localTranslationRepository.load();
  if (!settings.enabled) {
    const failedState = buildCaptionState({
      name: "failed",
      message: "번역 준비가 완료되지 않아 자막을 번역할 수 없습니다.",
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    return readStatus(context);
  }

  stateStore.clearLastError(tabId);

  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "detecting",
      message: "영상 자막을 찾는 중...",
    }),
  );

  const warmupPromise = warmLocalTranslationEndpoint(settings);
  const playerSnapshot = await readYouTubePlayerSnapshot(tabId);
  const pageCollectionPromise = withTimeout(
    sendPageMessage(tabId, {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "collect-caption-track",
      youtubePlayerResponse: playerSnapshot.playerResponse,
      selectedBaseUrl: playerSnapshot.selectedBaseUrl,
      selectedLabel: playerSnapshot.selectedLabel,
      selectedLanguageCode: playerSnapshot.selectedLanguageCode,
      videoTitle: playerSnapshot.videoTitle ?? status.tabTitle,
    }),
    PAGE_CAPTION_COLLECTION_TIMEOUT_MS,
  )
    .then(parseCaptionCollectionResponse)
    .catch(() => null);
  const backgroundCurrentTimePromise = readPageVideoCurrentTime(tabId).catch(() => null);
  let captionCollectionFailureMessage: string | null = null;
  const backgroundTrackPromise = collectBackgroundYouTubeCaptionTrack({
    settingsEndpoint: settings.endpoint,
    tabUrl: status.tabUrl ?? undefined,
    selectedLanguageCode: playerSnapshot.selectedLanguageCode,
    selectedLabel: playerSnapshot.selectedLabel,
    videoTitle: playerSnapshot.videoTitle ?? status.tabTitle,
  }).catch((error: unknown) => {
    captionCollectionFailureMessage =
      error instanceof Error ? error.message : "로컬 자막 수집 서비스가 응답하지 않습니다.";
    return null;
  });
  const collection = await resolveCaptionCollection({
    pageCollectionPromise,
    backgroundTrackPromise,
    backgroundCurrentTimePromise,
  });

  if (!collection) {
    const failedState = buildCaptionState({
      name: "failed",
      message: captionCollectionFailureMessage ?? "영상 자막 정보를 읽지 못했습니다.",
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    clearCaptionSession(tabId);
    return readStatus(context);
  }

  if (collection.state === "no-captions") {
    const message = collection.message
      ? `사용할 수 있는 영상 자막이 없습니다: ${collection.message}`
      : "사용할 수 있는 영상 자막이 없습니다.";
    const noCaptionState = buildCaptionState({
      name: "no-captions",
      message,
    });
    await updateCaptionState(tabId, noCaptionState);
    clearCaptionSession(tabId);
    return readStatus(context);
  }

  if (!collection.ok) {
    const failedState = buildCaptionState({
      name: "failed",
      message: collection.message || "영상 자막 정보를 읽지 못했습니다.",
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    clearCaptionSession(tabId);
    return readStatus(context);
  }

  const track = mapCaptionTrack(collection.track);
  const trackLabel = collection.track.label?.trim() || "Browser captions";
  const session = createCaptionSession({
    tabId,
    tabUrl: status.tabUrl,
    track,
    trackLabel,
  });
  const prefetchWindow = selectCaptionPrefetchWindow(track, {
    currentTimeSeconds: collection.currentTimeSeconds,
    lookAheadSeconds: CAPTION_PREFETCH_LOOKAHEAD_SECONDS,
    minimumCueCount: CAPTION_PREFETCH_MINIMUM_CUE_COUNT,
  });
  const visibleCueCount = prefetchWindow.cues.length;
  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "translating",
      message: "자막 번역 버퍼를 준비하는 중...",
      cueCount: visibleCueCount,
      trackLabel,
      progress: {
        total: visibleCueCount,
        completed: prefetchWindow.cues.filter((cue) =>
          session.translationsByCueId.has(cue.id),
        ).length,
        cacheHits: session.cacheHits,
        cacheMisses: session.cacheMisses,
        failures: prefetchWindow.cues.filter((cue) => session.failedCueIds.has(cue.id)).length,
      },
    }),
  );

  try {
    startCaptionSessionFill({
      session,
      settings,
      currentTimeSeconds: collection.currentTimeSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "영상 자막 번역에 실패했습니다.";
    const failedState = buildCaptionState({
      name: "failed",
      message,
      cueCount: visibleCueCount,
      trackLabel,
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    return readStatus(context);
  } finally {
    void warmupPromise.catch(() => undefined);
  }

  return readStatus(context);
}

async function setCaptionDisplayPreferences(
  preferences: CaptionDisplayPreferences,
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await installBridge(context);
  const currentSettings = await localTranslationRepository.load();
  const nextSettings = {
    ...currentSettings,
    displayMode: preferences.displayMode,
    captionLineOrder: preferences.captionLineOrder,
    captionFontSize: preferences.captionFontSize,
    captionOverlayPosition: preferences.captionOverlayPosition,
    captionBackgroundOpacity: preferences.captionBackgroundOpacity,
  };
  await localTranslationRepository.save(nextSettings);
  if (status.tabId !== null) {
    await sendPageMessage(status.tabId, {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "set-caption-display-preferences",
      preferences: captionDisplayPreferencesFromSettings(nextSettings),
    });
  }
  return readStatus(context);
}

async function cancelCaptionTranslation(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await readStatus(context);
  if (status.tabId === null) return status;
  const controller = stateStore.getCaptionController(status.tabId);
  clearCaptionSession(status.tabId);
  await updateCaptionState(
    status.tabId,
    buildCaptionState({
      name: "cancelled",
      message: controller ? "자막 번역을 취소했습니다." : "진행 중인 자막 번역이 없습니다.",
      cueCount: status.captionState.cueCount,
      trackLabel: status.captionState.trackLabel,
      progress: status.captionState.progress,
    }),
  );
  return readStatus(context);
}

async function runGeneratedCaptionTranslation(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await installBridge(context);
  if (!status.pageSupported || status.bridgeState !== "ready" || status.tabId === null) {
    return status;
  }
  const tabId = status.tabId;
  const settings = await localTranslationRepository.load();
  if (!settings.enabled) {
    const failedState = buildGeneratedCaptionState({
      name: "failed",
      message: "번역 준비가 완료되지 않아 자막을 생성할 수 없습니다.",
    });
    stateStore.setGeneratedCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateGeneratedCaptionState(tabId, failedState);
    await updateCaptionState(
      tabId,
      buildCaptionState({ name: "failed", message: failedState.message }),
    );
    return readStatus(context);
  }

  stateStore.abortGeneratedCaptionController(tabId);
  const controller = new AbortController();
  stateStore.setGeneratedCaptionController(tabId, controller);
  stateStore.clearLastError(tabId);

  await updateGeneratedCaptionState(
    tabId,
    buildGeneratedCaptionState({
      name: "transcribing",
      message: "영상 음성을 자막으로 준비하는 중...",
    }),
  );
  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "detecting",
      message: "영상 음성을 자막으로 변환하는 중...",
    }),
  );

  let track: CaptionTrackLike;
  try {
    track = await fetchGeneratedCaptionTrack({
      endpoint: settings.sttEndpoint,
      tabId,
      tabTitle: status.tabTitle,
      tabUrl: status.tabUrl,
      signal: controller.signal,
    });
  } catch (error) {
    const stateName =
      error instanceof GeneratedCaptionError && error.code === "cancelled" ? "cancelled" : "failed";
    const message =
      stateName === "cancelled" ? "자막 생성을 취소했습니다." : "자막 생성에 실패했습니다.";
    const failedState = buildGeneratedCaptionState({ name: stateName, message });
    stateStore.deleteGeneratedCaptionController(tabId);
    stateStore.setGeneratedCaptionState(tabId, failedState);
    if (stateName === "failed") stateStore.setLastError(tabId, message);
    await updateGeneratedCaptionState(tabId, failedState);
    await updateCaptionState(tabId, buildCaptionState({ name: stateName, message }));
    return readStatus(context);
  }

  const trackLabel = track.label?.trim() || "Generated captions";
  const cueCount = track.cues.length;
  const result = await runCaptionTranslationPipeline(
    settingsForCaptionTranslation(settings),
    track,
    {
      repository: localTranslationRepository,
      signal: controller.signal,
      onProgress: (progressResult) => {
        rememberGeneratedCaptionProgress(
          tabId,
          buildGeneratedCaptionState({
            name: "translating",
            message: "생성한 자막을 번역하는 중...",
            cueCount,
            trackLabel,
            progress: progressResult.progress,
          }),
        );
      },
    },
  );

  if (stateStore.getGeneratedCaptionController(tabId) !== controller) return readStatus(context);
  stateStore.deleteGeneratedCaptionController(tabId);

  if (result.jobResult.status === "cancelled" || controller.signal.aborted) {
    const cancelledState = buildGeneratedCaptionState({
      name: "cancelled",
      message: "자막 생성을 취소했습니다.",
      cueCount,
      trackLabel,
      progress: result.jobResult.progress,
    });
    await updateGeneratedCaptionState(tabId, cancelledState);
    await updateCaptionState(
      tabId,
      buildCaptionState({
        name: "cancelled",
        message: cancelledState.message,
        cueCount,
        trackLabel,
        progress: result.jobResult.progress,
      }),
    );
    return readStatus(context);
  }

  if (result.jobResult.status === "failed") {
    const message = "생성 자막 번역에 실패했습니다.";
    const failedState = buildGeneratedCaptionState({
      name: "failed",
      message,
      cueCount,
      trackLabel,
      progress: result.jobResult.progress,
    });
    stateStore.setGeneratedCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, message);
    await updateGeneratedCaptionState(tabId, failedState);
    await updateCaptionState(
      tabId,
      buildCaptionState({
        name: "failed",
        message,
        cueCount,
        trackLabel,
        progress: result.jobResult.progress,
      }),
    );
    return readStatus(context);
  }

  await sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "render-caption-overlay",
    trackLabel,
    cues: result.displayCues,
    preferences: captionDisplayPreferencesFromSettings(settings),
  });
  const renderedMessage = "생성 자막 번역이 표시되었습니다.";
  await updateGeneratedCaptionState(
    tabId,
    buildGeneratedCaptionState({
      name: "rendered",
      message: renderedMessage,
      cueCount: result.displayCues.length,
      trackLabel,
      progress: result.jobResult.progress,
    }),
  );
  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "rendered",
      message: renderedMessage,
      cueCount: result.displayCues.length,
      trackLabel,
      progress: result.jobResult.progress,
    }),
  );
  stateStore.clearLastError(tabId);
  return readStatus(context);
}

async function cancelGeneratedCaptionTranslation(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await readStatus(context);
  if (status.tabId === null) return status;
  const controller = stateStore.abortGeneratedCaptionController(status.tabId);
  const cancelledState = buildGeneratedCaptionState({
    name: "cancelled",
    message: controller ? "자막 생성을 취소했습니다." : "진행 중인 자막 생성이 없습니다.",
    cueCount: status.generatedCaptionState.cueCount,
    trackLabel: status.generatedCaptionState.trackLabel,
    progress: status.generatedCaptionState.progress,
  });
  await updateGeneratedCaptionState(status.tabId, cancelledState);
  await updateCaptionState(
    status.tabId,
    buildCaptionState({
      name: "cancelled",
      message: cancelledState.message,
      cueCount: status.captionState.cueCount,
      trackLabel: status.captionState.trackLabel,
      progress: status.captionState.progress,
    }),
  );
  return readStatus(context);
}

async function clearCaptionOverlay(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await installBridge(context);
  if (status.tabId === null) return status;
  clearCaptionSession(status.tabId);
  await sendPageMessage(status.tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "clear-caption-overlay",
  });
  stateStore.setCaptionState(status.tabId, ACTIVE_TAB_CAPTION_IDLE_STATE);
  stateStore.clearLastError(status.tabId);
  return readStatus(context);
}

function buildWebpageState(input: {
  readonly name: ActiveTabWebpageState["name"];
  readonly message: string;
  readonly blockCount?: number;
  readonly displayMode?: WebpageDisplayMode;
  readonly progress?: TranslationJobProgress | null;
}): ActiveTabWebpageState {
  return {
    name: input.name,
    message: input.message,
    blockCount: input.blockCount ?? 0,
    displayMode: input.displayMode ?? "bilingual",
    progress: input.progress ?? null,
  };
}

async function updateWebpageState(tabId: number, state: ActiveTabWebpageState): Promise<void> {
  stateStore.setWebpageState(tabId, state);
  await sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "show-webpage-state",
    webpageState: state,
  });
}

function rememberWebpageProgress(tabId: number, state: ActiveTabWebpageState): void {
  stateStore.setWebpageState(tabId, state);
  void sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "show-webpage-state",
    webpageState: state,
  }).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Could not update webpage translation progress.";
    stateStore.setLastError(tabId, message);
  });
}

async function runWebpageTranslation(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await installBridge(context);
  if (!status.pageSupported || status.bridgeState !== "ready" || status.tabId === null)
    return status;
  const tabId = status.tabId;
  const displayMode = status.webpageState.displayMode;

  const settings = await localTranslationRepository.load();
  if (!settings.enabled) {
    const failedState = buildWebpageState({
      name: "failed",
      message: "번역 준비가 완료되지 않아 페이지를 번역할 수 없습니다.",
      displayMode,
    });
    stateStore.setWebpageState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateWebpageState(tabId, failedState);
    return readStatus(context);
  }

  stateStore.abortWebpageController(tabId);
  const controller = new AbortController();
  stateStore.setWebpageController(tabId, controller);
  stateStore.clearLastError(tabId);

  await updateWebpageState(
    tabId,
    buildWebpageState({
      name: "collecting",
      message: "번역할 페이지 본문을 수집하는 중...",
      displayMode,
    }),
  );

  const collection = parseWebpageCollectionResponse(
    await sendPageMessage(tabId, {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "collect-webpage-text",
    }),
  );

  if (!collection) {
    const failedState = buildWebpageState({
      name: "failed",
      message: "페이지 본문을 읽지 못했습니다.",
      displayMode,
    });
    stateStore.setWebpageState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateWebpageState(tabId, failedState);
    stateStore.deleteWebpageController(tabId);
    return readStatus(context);
  }

  if (collection.state === "no-content") {
    const noContentState = buildWebpageState({
      name: "no-content",
      message: "번역할 페이지 본문을 찾지 못했습니다.",
      displayMode,
    });
    await updateWebpageState(tabId, noContentState);
    stateStore.deleteWebpageController(tabId);
    return readStatus(context);
  }

  if (!collection.ok) {
    const failedState = buildWebpageState({
      name: "failed",
      message: "페이지 본문을 읽지 못했습니다.",
      displayMode,
    });
    stateStore.setWebpageState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateWebpageState(tabId, failedState);
    stateStore.deleteWebpageController(tabId);
    return readStatus(context);
  }

  const blocks = collection.blocks;
  const blockCount = blocks.length;
  const inputs = buildWebpageTranslationInputs(blocks);
  await updateWebpageState(
    tabId,
    buildWebpageState({
      name: "translating",
      message: "페이지 본문을 번역하는 중...",
      blockCount,
      displayMode,
    }),
  );

  void (async (): Promise<void> => {
    const result = await LocalTranslationService.runJob(settings, inputs, {
      repository: localTranslationRepository,
      signal: controller.signal,
      onProgress: (progressResult) => {
        rememberWebpageProgress(
          tabId,
          buildWebpageState({
            name: "translating",
            message: "페이지 본문을 번역하는 중...",
            blockCount,
            displayMode,
            progress: progressResult.progress,
          }),
        );
      },
    });

    if (stateStore.getWebpageController(tabId) !== controller) return;
    stateStore.deleteWebpageController(tabId);

    if (result.status === "cancelled" || controller.signal.aborted) {
      const cancelledState = buildWebpageState({
        name: "cancelled",
        message: "페이지 번역을 취소했습니다.",
        blockCount,
        displayMode,
        progress: result.progress,
      });
      await updateWebpageState(tabId, cancelledState);
      return;
    }

    if (result.status === "failed") {
      const message = firstFailureMessage(result.errors, "페이지 번역에 실패했습니다.");
      const failedState = buildWebpageState({
        name: "failed",
        message,
        blockCount,
        displayMode,
        progress: result.progress,
      });
      stateStore.setWebpageState(tabId, failedState);
      stateStore.setLastError(tabId, failedState.message);
      await updateWebpageState(tabId, failedState);
      return;
    }

    const renderedBlocks = composeTranslatedWebpageBlocks(blocks, result.translations);
    await sendPageMessage(tabId, {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "render-webpage-translation",
      blocks: renderedBlocks,
      displayMode,
      targetLanguage: isBidirectionalKoEnTargetLanguage(settings.targetLanguage)
        ? "und"
        : settings.targetLanguage,
    });
    await updateWebpageState(
      tabId,
      buildWebpageState({
        name: "rendered",
        message: "페이지 번역이 표시되었습니다.",
        blockCount: renderedBlocks.length,
        displayMode,
        progress: result.progress,
      }),
    );
    stateStore.clearLastError(tabId);
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "페이지 번역에 실패했습니다.";
    stateStore.setLastError(tabId, message);
    void updateWebpageState(
      tabId,
      buildWebpageState({
        name: "failed",
        message,
        blockCount,
        displayMode,
      }),
    );
  });

  return readStatus(context);
}

async function cancelWebpageTranslation(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await readStatus(context);
  const tabIds = new Set<number>(stateStore.activeWebpageControllerTabIds());
  if (status.tabId !== null) tabIds.add(status.tabId);
  if (tabIds.size === 0) return status;

  for (const tabId of tabIds) {
    const controller = stateStore.getWebpageController(tabId);
    if (controller) {
      controller.abort();
      stateStore.deleteWebpageController(tabId);
    }
    const currentState =
      tabId === status.tabId
        ? status.webpageState
        : (stateStore.getWebpageState(tabId) ?? ACTIVE_TAB_WEBPAGE_IDLE_STATE);
    await updateWebpageState(
      tabId,
      buildWebpageState({
        name: "cancelled",
        message: controller ? "페이지 번역을 취소했습니다." : "진행 중인 페이지 번역이 없습니다.",
        blockCount: currentState.blockCount,
        displayMode: currentState.displayMode,
        progress: currentState.progress,
      }),
    );
  }
  return readStatus(context);
}

async function clearWebpageTranslation(
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await installBridge(context);
  if (status.tabId === null) return status;
  stateStore.abortWebpageController(status.tabId);
  await sendPageMessage(status.tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "clear-webpage-translation",
  });
  stateStore.setWebpageState(status.tabId, ACTIVE_TAB_WEBPAGE_IDLE_STATE);
  stateStore.clearLastError(status.tabId);
  return readStatus(context);
}

async function setWebpageDisplayMode(
  displayMode: WebpageDisplayMode,
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  const status = await installBridge(context);
  if (status.tabId === null) return status;
  const nextState = buildWebpageState({
    name: status.webpageState.name,
    message: status.webpageState.message,
    blockCount: status.webpageState.blockCount,
    displayMode,
    progress: status.webpageState.progress,
  });
  stateStore.setWebpageState(status.tabId, nextState);
  await sendPageMessage(status.tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "set-webpage-display-mode",
    displayMode,
  });
  return readStatus(context);
}

export async function handleControlRequest(
  request: ActiveTabTranslationControlRequest,
  context: ActiveTabTranslationRequestContext = {},
): Promise<ActiveTabTranslationStatus> {
  if (request.type === "install-bridge") return installBridge(context);
  if (request.type === "run-caption-translation") return runCaptionTranslation(context);
  if (request.type === "cancel-caption-translation") return cancelCaptionTranslation(context);
  if (request.type === "run-generated-caption-translation") {
    return runGeneratedCaptionTranslation(context);
  }
  if (request.type === "cancel-generated-caption-translation") {
    return cancelGeneratedCaptionTranslation(context);
  }
  if (request.type === "clear-caption-overlay") return clearCaptionOverlay(context);
  if (request.type === "run-webpage-translation") return runWebpageTranslation(context);
  if (request.type === "cancel-webpage-translation") return cancelWebpageTranslation(context);
  if (request.type === "clear-webpage-translation") return clearWebpageTranslation(context);
  if (request.type === "set-webpage-display-mode") {
    return setWebpageDisplayMode(request.displayMode, context);
  }
  if (request.type === "set-caption-display-preferences") {
    return setCaptionDisplayPreferences(request.preferences, context);
  }
  return readStatus(context);
}

export function buildFailureStatus(error: unknown): ActiveTabTranslationStatus {
  const detail =
    error instanceof Error ? error.message : "Current-page translation request failed.";
  return buildActiveTabTranslationStatus({
    tab: null,
    bridgeReady: false,
    settings: DEFAULT_LOCAL_TRANSLATION_SETTINGS,
    captionState: buildCaptionState({ name: "failed", message: detail }),
    webpageState: buildWebpageState({ name: "failed", message: detail }),
    lastError: detail,
  });
}

export function clearTabState(tabId: number): void {
  clearCaptionSession(tabId);
  stateStore.clearTab(tabId);
}
