import { browser } from "wxt/browser";
import {
  ACTIVE_TAB_CAPTION_IDLE_STATE,
  ACTIVE_TAB_GENERATED_CAPTION_IDLE_STATE,
  ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
  ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
  ACTIVE_TAB_WEBPAGE_IDLE_STATE,
  type ActiveTabCaptionState,
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
  type TranslationJobProgress,
} from "./local-translation";
import {
  buildWebpageTranslationInputs,
  composeTranslatedWebpageBlocks,
  type WebpageDisplayMode,
} from "./webpage-translation";
import { selectInitialCaptionWindow } from "./youtube-captions";

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

async function readYouTubePlayerResponse(tabId: number): Promise<unknown> {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readYouTubePlayerResponseInMainWorld,
    });
    return result?.result ?? null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read player data." };
  }
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
    const message = error instanceof Error ? error.message : "Could not update caption progress.";
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
      error instanceof Error ? error.message : "Could not update generated caption progress.";
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
      message: "Enable local translation in settings before translating captions.",
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    return readStatus(context);
  }

  stateStore.abortCaptionController(tabId);
  const controller = new AbortController();
  stateStore.setCaptionController(tabId, controller);
  stateStore.clearLastError(tabId);

  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "detecting",
      message: "Looking for browser-detectable captions...",
    }),
  );

  const collection = parseCaptionCollectionResponse(
    await sendPageMessage(tabId, {
      scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      type: "collect-caption-track",
      youtubePlayerResponse: await readYouTubePlayerResponse(tabId),
    }),
  );

  if (!collection) {
    const failedState = buildCaptionState({
      name: "failed",
      message: "The injected bridge returned malformed caption data.",
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
      message: collection.message,
    });
    await updateCaptionState(tabId, noCaptionState);
    stateStore.deleteCaptionController(tabId);
    return readStatus(context);
  }

  if (!collection.ok) {
    const failedState = buildCaptionState({ name: "failed", message: collection.message });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    stateStore.deleteCaptionController(tabId);
    return readStatus(context);
  }

  const translateTrack =
    collection.track.source?.platform === "youtube"
      ? selectInitialCaptionWindow(collection.track, {
          currentTimeSeconds: collection.currentTimeSeconds,
          maxCueCount: 4,
        })
      : collection.track;
  const trackLabel = translateTrack.label?.trim() || "Browser captions";
  const cueCount = translateTrack.cues.length;
  const result = await runCaptionTranslationPipeline(settings, translateTrack, {
    repository: localTranslationRepository,
    signal: controller.signal,
    onProgress: (progressResult) => {
      rememberProgress(
        tabId,
        buildCaptionState({
          name: "translating",
          message: `Translating ${cueCount} caption cues...`,
          cueCount,
          trackLabel,
          progress: progressResult.progress,
        }),
      );
    },
  });

  if (stateStore.getCaptionController(tabId) !== controller) return readStatus(context);
  stateStore.deleteCaptionController(tabId);

  if (result.jobResult.status === "cancelled" || controller.signal.aborted) {
    const cancelledState = buildCaptionState({
      name: "cancelled",
      message: "Caption translation was cancelled.",
      cueCount,
      trackLabel,
      progress: result.jobResult.progress,
    });
    await updateCaptionState(tabId, cancelledState);
    return readStatus(context);
  }

  if (result.jobResult.status === "failed") {
    const [error] = result.jobResult.errors;
    const failedState = buildCaptionState({
      name: "failed",
      message: error?.message ?? "Caption translation failed.",
      cueCount,
      trackLabel,
      progress: result.jobResult.progress,
    });
    stateStore.setCaptionState(tabId, failedState);
    stateStore.setLastError(tabId, failedState.message);
    await updateCaptionState(tabId, failedState);
    return readStatus(context);
  }

  await sendPageMessage(tabId, {
    scope: ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
    type: "render-caption-overlay",
    trackLabel,
    cues: result.displayCues,
    preferences: captionDisplayPreferencesFromSettings(settings),
  });
  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "rendered",
      message: `Rendered ${result.displayCues.length} bilingual caption cues.`,
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
      message: controller
        ? "Caption translation was cancelled."
        : "No caption translation is running.",
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
      message: "Enable local translation in settings before generating captions.",
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
      message: "Requesting generated captions from the local STT endpoint...",
    }),
  );
  await updateCaptionState(
    tabId,
    buildCaptionState({
      name: "detecting",
      message: "Generating captions from local STT endpoint...",
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
    const message = error instanceof Error ? error.message : "Generated caption STT failed.";
    const stateName =
      error instanceof GeneratedCaptionError && error.code === "cancelled" ? "cancelled" : "failed";
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
  const result = await runCaptionTranslationPipeline(settings, track, {
    repository: localTranslationRepository,
    signal: controller.signal,
    onProgress: (progressResult) => {
      rememberGeneratedCaptionProgress(
        tabId,
        buildGeneratedCaptionState({
          name: "translating",
          message: `Translating ${cueCount} generated caption cues...`,
          cueCount,
          trackLabel,
          progress: progressResult.progress,
        }),
      );
    },
  });

  if (stateStore.getGeneratedCaptionController(tabId) !== controller) return readStatus(context);
  stateStore.deleteGeneratedCaptionController(tabId);

  if (result.jobResult.status === "cancelled" || controller.signal.aborted) {
    const cancelledState = buildGeneratedCaptionState({
      name: "cancelled",
      message: "Generated caption run was cancelled.",
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
    const [error] = result.jobResult.errors;
    const message = error?.message ?? "Generated caption translation failed.";
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
  const renderedMessage = `Rendered ${result.displayCues.length} generated bilingual caption cues.`;
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
    message: controller
      ? "Generated caption run was cancelled."
      : "No generated caption run is active.",
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
      message: "Enable local translation in settings before translating webpage text.",
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
      message: "Collecting readable webpage text blocks...",
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
      message: "The injected bridge returned malformed webpage text data.",
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
      message: collection.message,
      displayMode,
    });
    await updateWebpageState(tabId, noContentState);
    stateStore.deleteWebpageController(tabId);
    return readStatus(context);
  }

  if (!collection.ok) {
    const failedState = buildWebpageState({
      name: "failed",
      message: collection.message,
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
      message: `Translating ${blockCount} webpage text blocks...`,
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
            message: `Translating ${blockCount} webpage text blocks...`,
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
        message: "Webpage translation was cancelled.",
        blockCount,
        displayMode,
        progress: result.progress,
      });
      await updateWebpageState(tabId, cancelledState);
      return;
    }

    if (result.status === "failed") {
      const [error] = result.errors;
      const failedState = buildWebpageState({
        name: "failed",
        message: error?.message ?? "Webpage translation failed.",
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
        message: `Rendered ${renderedBlocks.length} translated webpage text blocks.`,
        blockCount: renderedBlocks.length,
        displayMode,
        progress: result.progress,
      }),
    );
    stateStore.clearLastError(tabId);
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Webpage translation failed.";
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
        message: controller
          ? "Webpage translation was cancelled."
          : "No webpage translation is running.",
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
