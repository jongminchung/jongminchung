import type {
  ActiveTabCaptionState,
  ActiveTabGeneratedCaptionState,
  ActiveTabWebpageState,
} from "./active-tab-translation";

export class ActiveTabTranslationStateStore {
  private readonly bridgeReadyTabIds = new Set<number>();
  private readonly lastErrorsByTabId = new Map<number, string>();
  private readonly captionStatesByTabId = new Map<number, ActiveTabCaptionState>();
  private readonly captionControllersByTabId = new Map<number, AbortController>();
  private readonly generatedCaptionStatesByTabId = new Map<
    number,
    ActiveTabGeneratedCaptionState
  >();
  private readonly generatedCaptionControllersByTabId = new Map<number, AbortController>();
  private readonly webpageStatesByTabId = new Map<number, ActiveTabWebpageState>();
  private readonly webpageControllersByTabId = new Map<number, AbortController>();

  private constructor() {}

  static create(): ActiveTabTranslationStateStore {
    return new ActiveTabTranslationStateStore();
  }

  isBridgeReady(tabId: number): boolean {
    return this.bridgeReadyTabIds.has(tabId);
  }

  markBridgeReady(tabId: number): void {
    this.bridgeReadyTabIds.add(tabId);
  }

  setLastError(tabId: number, message: string): void {
    this.lastErrorsByTabId.set(tabId, message);
  }

  getLastError(tabId: number): string | null {
    return this.lastErrorsByTabId.get(tabId) ?? null;
  }

  clearLastError(tabId: number): void {
    this.lastErrorsByTabId.delete(tabId);
  }

  getCaptionState(tabId: number): ActiveTabCaptionState | null {
    return this.captionStatesByTabId.get(tabId) ?? null;
  }

  setCaptionState(tabId: number, state: ActiveTabCaptionState): void {
    this.captionStatesByTabId.set(tabId, state);
  }

  getCaptionController(tabId: number): AbortController | null {
    return this.captionControllersByTabId.get(tabId) ?? null;
  }

  setCaptionController(tabId: number, controller: AbortController): void {
    this.captionControllersByTabId.set(tabId, controller);
  }

  abortCaptionController(tabId: number): AbortController | null {
    return this.abortAndDeleteController(tabId, this.captionControllersByTabId);
  }

  deleteCaptionController(tabId: number): void {
    this.captionControllersByTabId.delete(tabId);
  }

  getGeneratedCaptionState(tabId: number): ActiveTabGeneratedCaptionState | null {
    return this.generatedCaptionStatesByTabId.get(tabId) ?? null;
  }

  setGeneratedCaptionState(tabId: number, state: ActiveTabGeneratedCaptionState): void {
    this.generatedCaptionStatesByTabId.set(tabId, state);
  }

  getGeneratedCaptionController(tabId: number): AbortController | null {
    return this.generatedCaptionControllersByTabId.get(tabId) ?? null;
  }

  setGeneratedCaptionController(tabId: number, controller: AbortController): void {
    this.generatedCaptionControllersByTabId.set(tabId, controller);
  }

  abortGeneratedCaptionController(tabId: number): AbortController | null {
    return this.abortAndDeleteController(tabId, this.generatedCaptionControllersByTabId);
  }

  deleteGeneratedCaptionController(tabId: number): void {
    this.generatedCaptionControllersByTabId.delete(tabId);
  }

  getWebpageState(tabId: number): ActiveTabWebpageState | null {
    return this.webpageStatesByTabId.get(tabId) ?? null;
  }

  setWebpageState(tabId: number, state: ActiveTabWebpageState): void {
    this.webpageStatesByTabId.set(tabId, state);
  }

  getWebpageController(tabId: number): AbortController | null {
    return this.webpageControllersByTabId.get(tabId) ?? null;
  }

  setWebpageController(tabId: number, controller: AbortController): void {
    this.webpageControllersByTabId.set(tabId, controller);
  }

  abortWebpageController(tabId: number): AbortController | null {
    return this.abortAndDeleteController(tabId, this.webpageControllersByTabId);
  }

  deleteWebpageController(tabId: number): void {
    this.webpageControllersByTabId.delete(tabId);
  }

  activeWebpageControllerTabIds(): readonly number[] {
    return [...this.webpageControllersByTabId.keys()];
  }

  clearTab(tabId: number): void {
    this.bridgeReadyTabIds.delete(tabId);
    this.clearLastError(tabId);
    this.captionStatesByTabId.delete(tabId);
    this.abortCaptionController(tabId);
    this.generatedCaptionStatesByTabId.delete(tabId);
    this.abortGeneratedCaptionController(tabId);
    this.webpageStatesByTabId.delete(tabId);
    this.abortWebpageController(tabId);
  }

  private abortAndDeleteController(
    tabId: number,
    controllersByTabId: Map<number, AbortController>,
  ): AbortController | null {
    const controller = controllersByTabId.get(tabId) ?? null;
    if (controller) controller.abort();
    controllersByTabId.delete(tabId);
    return controller;
  }
}
