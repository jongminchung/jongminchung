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
import { type CaptionTrackLike, runCaptionTranslationPipeline } from "./caption-translation";
import {
  runPrioritizedCaptionTranslationPipeline,
  type PrioritizedCaptionTranslationResult,
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
  type LocalTranslationSettings,
  type TranslationJobProgress,
} from "./local-translation";
import {
  buildWebpageTranslationInputs,
  composeTranslatedWebpageBlocks,
  type WebpageDisplayMode,
} from "./webpage-translation";
import { preferredYouTubeCaptionLanguageCodes } from "./youtube-captions";

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
const INITIAL_YOUTUBE_CAPTION_WINDOW_CUE_COUNT = 3;
const FOLLOWUP_YOUTUBE_CAPTION_WINDOW_CUE_COUNT = 8;
const CAPTION_TRANSLATION_BATCH_SIZE = 4;
const INITIAL_CAPTION_TRANSLATION_BATCH_SIZE = 3;
const BACKGROUND_CAPTION_TRANSLATION_BATCH_SIZE = 8;
const PAGE_CAPTION_COLLECTION_TIMEOUT_MS = 4_000;
const LOCAL_TRANSLATION_WARMUP_TIMEOUT_MS = 4_000;
const LOCAL_TRANSLATION_WARMUP_TTL_MS = 10 * 60_000;
const localTranslationWarmups = new Map<string, number>();

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function youtubeVideoIdFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.hostname.includes("youtube.com") ? (url.searchParams.get("v") ?? null) : null;
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
  if (!response.ok) return null;
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

  const activeController = stateStore.getCaptionController(tabId);
  if (activeController && !activeController.signal.aborted) activeController.abort();

  const controller = new AbortController();
  stateStore.setCaptionController(tabId, controller);
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
  const backgroundTrackPromise = collectBackgroundYouTubeCaptionTrack({
    settingsEndpoint: settings.endpoint,
    tabUrl: status.tabUrl ?? undefined,
    selectedLanguageCode: playerSnapshot.selectedLanguageCode,
    selectedLabel: playerSnapshot.selectedLabel,
    videoTitle: playerSnapshot.videoTitle ?? status.tabTitle,
  }).catch(() => null);
  const collection = await resolveCaptionCollection({
    pageCollectionPromise,
    backgroundTrackPromise,
    backgroundCurrentTimePromise,
  });

  if (!collection) {
    const failedState = buildCaptionState({
      name: "failed",
      message: "영상 자막 정보를 읽지 못했습니다.",
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    stateStore.deleteCaptionController(tabId);
    return readStatus(context);
  }

  if (collection.state === "no-captions") {
    const noCaptionState = buildCaptionState({
      name: "no-captions",
      message: "사용할 수 있는 영상 자막이 없습니다.",
    });
    await updateCaptionState(tabId, noCaptionState);
    stateStore.deleteCaptionController(tabId);
    return readStatus(context);
  }

  if (!collection.ok) {
    const failedState = buildCaptionState({
      name: "failed",
      message: "영상 자막 정보를 읽지 못했습니다.",
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    stateStore.deleteCaptionController(tabId);
    return readStatus(context);
  }

  const isYouTubeTrack = collection.track.source?.platform === "youtube";
  const visibleCueCount = isYouTubeTrack
    ? Math.min(collection.track.cues.length, FOLLOWUP_YOUTUBE_CAPTION_WINDOW_CUE_COUNT)
    : collection.track.cues.length;
  const initialCueCount = Math.min(
    visibleCueCount,
    isYouTubeTrack ? INITIAL_YOUTUBE_CAPTION_WINDOW_CUE_COUNT : INITIAL_CAPTION_TRANSLATION_BATCH_SIZE,
  );
  const trackLabel = collection.track.label?.trim() || "Browser captions";
  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "translating",
      message: "자막을 번역하는 중...",
      cueCount: visibleCueCount,
      trackLabel,
      progress: {
        total: visibleCueCount,
        completed: 0,
        cacheHits: 0,
        cacheMisses: 0,
        failures: 0,
      },
    }),
  );

  let result: PrioritizedCaptionTranslationResult;
  try {
    result = await runPrioritizedCaptionTranslationPipeline(
      settingsForCaptionTranslation(settings),
      collection.track,
      {
        repository: localTranslationRepository,
        signal: controller.signal,
        currentTimeSeconds: collection.currentTimeSeconds,
        initialCueCount,
        visibleCueCount,
        initialBatchSize: INITIAL_CAPTION_TRANSLATION_BATCH_SIZE,
        backgroundBatchSize: BACKGROUND_CAPTION_TRANSLATION_BATCH_SIZE,
        onSnapshot: async (snapshot) => {
          if (stateStore.getCaptionController(tabId) !== controller || controller.signal.aborted) {
            return;
          }
          const renderResponse = parseRenderCaptionOverlayResponse(
            await sendPageMessage(tabId, {
              scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
              type: "render-caption-overlay",
              trackLabel,
              cues: snapshot.displayCues,
              preferences: captionDisplayPreferencesFromSettings(settings),
            }),
          );
          if (!renderResponse.ok || renderResponse.renderedCueCount === 0) {
            throw new Error(renderResponse.message ?? "자막 번역을 표시하지 못했습니다.");
          }
          const stateName =
            snapshot.jobResult.progress.completed >= snapshot.jobResult.progress.total &&
            snapshot.jobResult.progress.total > 0
              ? "rendered"
              : "translating";
          rememberProgress(
            tabId,
            buildCaptionState({
              name: stateName,
              message:
                stateName === "rendered"
                  ? "자막 번역이 표시되었습니다."
                  : "자막을 번역하는 중...",
              cueCount: snapshot.displayCues.length,
              trackLabel,
              progress: snapshot.jobResult.progress,
            }),
          );
        },
      },
    );
  } catch (error) {
    if (stateStore.getCaptionController(tabId) !== controller) return readStatus(context);
    stateStore.deleteCaptionController(tabId);
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
    void warmupPromise;
  }

  if (stateStore.getCaptionController(tabId) !== controller) return readStatus(context);
  stateStore.deleteCaptionController(tabId);

  if (result.jobResult.status === "cancelled" || controller.signal.aborted) {
    const cancelledState = buildCaptionState({
      name: "cancelled",
      message: "자막 번역을 취소했습니다.",
      cueCount: result.displayCues.length,
      trackLabel,
      progress: result.jobResult.progress,
    });
    await updateCaptionState(tabId, cancelledState);
    return readStatus(context);
  }

  if (result.jobResult.status === "failed") {
    const failedState = buildCaptionState({
      name: "failed",
      message: "영상 자막 번역에 실패했습니다.",
      cueCount: result.displayCues.length,
      trackLabel,
      progress: result.jobResult.progress,
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    return readStatus(context);
  }

  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "rendered",
      message: "자막 번역이 표시되었습니다.",
      cueCount: result.displayCues.length,
      trackLabel,
      progress: result.jobResult.progress,
    }),
  );
  stateStore.clearLastError(tabId);
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
  const controller = stateStore.abortCaptionController(status.tabId);
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
  stateStore.abortCaptionController(status.tabId);
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
      const failedState = buildWebpageState({
        name: "failed",
        message: "페이지 번역에 실패했습니다.",
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
  })().catch(() => {
    const message = "페이지 번역에 실패했습니다.";
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
  stateStore.clearTab(tabId);
}
