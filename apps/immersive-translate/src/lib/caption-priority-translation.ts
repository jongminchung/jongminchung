import {
  buildCaptionTranslationInputs,
  composeBilingualCaptionCues,
  mapCaptionTrack,
  type BilingualCaptionCue,
  type CaptionCue,
  type CaptionTrack,
  type CaptionTrackLike,
} from "./caption-translation";
import {
  type LocalTranslationError,
  type LocalTranslationFetch,
  type LocalTranslationRepository,
  LocalTranslationService,
  type LocalTranslationSettings,
  type TranslationInput,
  type TranslationJobProgress,
  type TranslationJobResult,
  type TranslationJobStatus,
  type TranslationOutput,
} from "./local-translation";

export interface PrioritizedCaptionWindowOptions {
  readonly currentTimeSeconds?: number | null;
  readonly initialCueCount: number;
  readonly visibleCueCount: number;
}

export interface PrioritizedCaptionWindow {
  readonly visibleTrack: CaptionTrack;
  readonly initialTrack: CaptionTrack;
}

export interface PrioritizedCaptionTranslationSnapshot {
  readonly track: CaptionTrack;
  readonly translationInputs: readonly TranslationInput[];
  readonly jobResult: TranslationJobResult;
  readonly displayCues: readonly BilingualCaptionCue[];
}

export interface RunPrioritizedCaptionTranslationOptions {
  readonly repository?: LocalTranslationRepository;
  readonly signal?: AbortSignal;
  readonly currentTimeSeconds?: number | null;
  readonly initialCueCount: number;
  readonly visibleCueCount: number;
  readonly initialBatchSize: number;
  readonly backgroundBatchSize: number;
  readonly fetcher?: LocalTranslationFetch;
  readonly onSnapshot?: (
    snapshot: PrioritizedCaptionTranslationSnapshot,
  ) => void | Promise<void>;
}

export interface PrioritizedCaptionTranslationResult
  extends PrioritizedCaptionTranslationSnapshot {}

function cuePriority(
  cue: Pick<CaptionCue, "startTimeSeconds" | "endTimeSeconds">,
  index: number,
  currentTimeSeconds: number | null,
): number {
  if (currentTimeSeconds === null) return index;
  if (cue.startTimeSeconds <= currentTimeSeconds && currentTimeSeconds < cue.endTimeSeconds) {
    return -1_000_000 + index / 10_000;
  }
  if (cue.endTimeSeconds >= currentTimeSeconds) {
    return cue.startTimeSeconds - currentTimeSeconds + index / 10_000;
  }
  return 1_000_000 + (currentTimeSeconds - cue.endTimeSeconds) + index / 10_000;
}

function sortedByPlaybackPriority(
  cues: readonly CaptionCue[],
  currentTimeSeconds: number | null,
): readonly CaptionCue[] {
  return cues
    .map((cue, index) => ({ cue, priority: cuePriority(cue, index, currentTimeSeconds) }))
    .sort((left, right) => left.priority - right.priority)
    .map((entry) => entry.cue);
}

function trackWithCues(track: CaptionTrack, cues: readonly CaptionCue[]): CaptionTrack {
  return { ...track, cues: [...cues].sort((left, right) => left.index - right.index) };
}

export function selectPrioritizedCaptionWindow(
  track: CaptionTrack,
  options: PrioritizedCaptionWindowOptions,
): PrioritizedCaptionWindow {
  const currentTimeSeconds =
    typeof options.currentTimeSeconds === "number" && Number.isFinite(options.currentTimeSeconds)
      ? options.currentTimeSeconds
      : null;
  const prioritizedCues = sortedByPlaybackPriority(track.cues, currentTimeSeconds);
  const visibleCues = prioritizedCues.slice(0, options.visibleCueCount);
  const visibleCueIds = new Set(visibleCues.map((cue) => cue.id));
  const initialCues = prioritizedCues
    .filter((cue) => visibleCueIds.has(cue.id))
    .slice(0, options.initialCueCount);

  return {
    visibleTrack: trackWithCues(track, visibleCues),
    initialTrack: trackWithCues(track, initialCues),
  };
}

function emptyProgress(total: number): TranslationJobProgress {
  return { total, completed: 0, cacheHits: 0, cacheMisses: 0, failures: 0 };
}

function resolveStatus(input: {
  readonly total: number;
  readonly completed: number;
  readonly errors: readonly LocalTranslationError[];
  readonly signal?: AbortSignal;
}): TranslationJobStatus {
  const failures = input.errors.reduce((count, error) => count + error.inputIds.length, 0);
  if (input.signal?.aborted) return input.completed > 0 ? "partial" : "cancelled";
  if (input.completed + failures < input.total) return "running";
  if (input.errors.length === 0) return "succeeded";
  return input.completed > 0 ? "partial" : "failed";
}

function buildResult(input: {
  readonly track: CaptionTrack;
  readonly translationInputs: readonly TranslationInput[];
  readonly translations: ReadonlyMap<string, string>;
  readonly errors: readonly LocalTranslationError[];
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly signal?: AbortSignal;
}): TranslationJobResult {
  const outputs = input.translationInputs.flatMap((translationInput): TranslationOutput[] => {
    const text = input.translations.get(translationInput.id);
    return text === undefined ? [] : [{ id: translationInput.id, text }];
  });
  const failures = input.errors.reduce((count, error) => count + error.inputIds.length, 0);
  return {
    status: resolveStatus({
      total: input.translationInputs.length,
      completed: outputs.length,
      errors: input.errors,
      signal: input.signal,
    }),
    translations: outputs,
    errors: input.errors,
    progress: {
      total: input.translationInputs.length,
      completed: outputs.length,
      cacheHits: input.cacheHits,
      cacheMisses: input.cacheMisses,
      failures,
    },
  };
}

function splitInputs(
  inputs: readonly TranslationInput[],
  batchSize: number,
): readonly (readonly TranslationInput[])[] {
  const chunks: TranslationInput[][] = [];
  for (let index = 0; index < inputs.length; index += batchSize) {
    chunks.push(inputs.slice(index, index + batchSize));
  }
  return chunks;
}

export async function runPrioritizedCaptionTranslationPipeline(
  settings: LocalTranslationSettings,
  captionTrack: CaptionTrackLike,
  options: RunPrioritizedCaptionTranslationOptions,
): Promise<PrioritizedCaptionTranslationResult> {
  const track = mapCaptionTrack(captionTrack);
  const { visibleTrack, initialTrack } = selectPrioritizedCaptionWindow(track, {
    currentTimeSeconds: options.currentTimeSeconds,
    initialCueCount: options.initialCueCount,
    visibleCueCount: options.visibleCueCount,
  });
  const translationInputs = buildCaptionTranslationInputs(visibleTrack.cues);
  const translations = new Map<string, string>();
  const errors: LocalTranslationError[] = [];
  let cacheHits = 0;
  let cacheMisses = 0;

  const createSnapshot = (): PrioritizedCaptionTranslationSnapshot => {
    const jobResult = buildResult({
      track: visibleTrack,
      translationInputs,
      translations,
      errors,
      cacheHits,
      cacheMisses,
      signal: options.signal,
    });
    return {
      track: visibleTrack,
      translationInputs,
      jobResult,
      displayCues: composeBilingualCaptionCues(visibleTrack.cues, jobResult.translations),
    };
  };

  const publishSnapshot = async (): Promise<void> => {
    await options.onSnapshot?.(createSnapshot());
  };

  await publishSnapshot();
  if (translationInputs.length === 0 || options.signal?.aborted) return createSnapshot();

  const initialInputIds = new Set(initialTrack.cues.map((cue) => cue.id));
  const initialInputs = translationInputs.filter((input) => initialInputIds.has(input.id));
  const backgroundInputs = translationInputs.filter((input) => !initialInputIds.has(input.id));
  const chunks = [
    ...splitInputs(initialInputs, options.initialBatchSize),
    ...splitInputs(backgroundInputs, options.backgroundBatchSize),
  ];

  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    if (options.signal?.aborted) break;
    const result = await LocalTranslationService.runJob(
      { ...settings, batchSize: chunk.length },
      chunk,
      {
        repository: options.repository,
        signal: options.signal,
        fetcher: options.fetcher,
      },
    );
    for (const translation of result.translations) {
      translations.set(translation.id, translation.text);
    }
    errors.push(...result.errors);
    cacheHits += result.progress.cacheHits;
    cacheMisses += result.progress.cacheMisses;
    await publishSnapshot();
  }

  return createSnapshot();
}
