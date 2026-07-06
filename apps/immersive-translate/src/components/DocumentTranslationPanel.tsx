import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import {
  buildDocumentTranslationInputs,
  composeTranslatedDocumentBlocks,
  extractDocumentTextBlocks,
  type TranslatedDocumentTextBlock,
} from "../lib/document-translation";
import {
  DEFAULT_LOCAL_TRANSLATION_SETTINGS,
  LocalTranslationRepository,
  LocalTranslationService,
  type LocalTranslationSettings,
} from "../lib/local-translation";

type DocumentTranslationStateName = "idle" | "reading" | "translating" | "rendered" | "failed";

interface DocumentTranslationState {
  readonly name: DocumentTranslationStateName;
  readonly message: string;
  readonly fileName: string | null;
  readonly blocks: readonly TranslatedDocumentTextBlock[];
}

const DOCUMENT_IDLE_STATE: DocumentTranslationState = {
  name: "idle",
  message: "Upload a DOCX or EPUB document and render bilingual translation blocks.",
  fileName: null,
  blocks: [],
};

const localTranslationRepository = LocalTranslationRepository.ofStorage(browser.storage.local);

function cx(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

function localLabel(loaded: boolean, settings: LocalTranslationSettings): string {
  if (!loaded) return "Checking";
  return settings.enabled ? "Local translation enabled" : "Local translation disabled";
}

function documentLabel(state: DocumentTranslationState): string {
  if (state.name === "idle") return "Document idle";
  if (state.name === "reading") return "Reading document";
  if (state.name === "translating") return "Translating document";
  if (state.name === "rendered") return "Document rendered";
  return "Document failed";
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function DocumentTranslationPanel(): JSX.Element {
  const [localSettings, setLocalSettings] = useState<LocalTranslationSettings>(
    DEFAULT_LOCAL_TRANSLATION_SETTINGS,
  );
  const [localSettingsLoaded, setLocalSettingsLoaded] = useState(false);
  const [localTranslationTesting, setLocalTranslationTesting] = useState(false);
  const [localTranslationTestResult, setLocalTranslationTestResult] = useState<{
    readonly ok: boolean;
    readonly message: string;
  } | null>(null);
  const [documentState, setDocumentState] = useState<DocumentTranslationState>(DOCUMENT_IDLE_STATE);
  const [documentBusy, setDocumentBusy] = useState(false);

  const saveLocalSettings = useCallback(
    async (nextSettings: LocalTranslationSettings): Promise<void> => {
      setLocalSettings(nextSettings);
      setLocalTranslationTestResult(null);
      await localTranslationRepository.save(nextSettings);
    },
    [],
  );

  const patchLocalSettings = useCallback(
    (patch: Partial<LocalTranslationSettings>): void => {
      void saveLocalSettings({ ...localSettings, ...patch });
    },
    [localSettings, saveLocalSettings],
  );

  const testLocalTranslation = useCallback(async (): Promise<void> => {
    setLocalTranslationTesting(true);
    try {
      const result = await LocalTranslationService.selfTest(localSettings);
      setLocalTranslationTestResult(result);
    } finally {
      setLocalTranslationTesting(false);
    }
  }, [localSettings]);

  const translateDocument = useCallback(async (file: File): Promise<void> => {
    setDocumentBusy(true);
    setDocumentState({
      name: "reading",
      message: `Reading ${file.name}...`,
      fileName: file.name,
      blocks: [],
    });

    try {
      const settings = await localTranslationRepository.load();
      if (!settings.enabled) {
        setDocumentState({
          name: "failed",
          message: "Enable local translation in settings before translating documents.",
          fileName: file.name,
          blocks: [],
        });
        return;
      }

      const sourceBlocks = await extractDocumentTextBlocks(file.name, await file.arrayBuffer());
      setDocumentState({
        name: "translating",
        message: `Translating ${sourceBlocks.length} document blocks...`,
        fileName: file.name,
        blocks: [],
      });

      const result = await LocalTranslationService.runJob(
        settings,
        buildDocumentTranslationInputs(sourceBlocks),
        { repository: localTranslationRepository },
      );

      if (result.status === "failed" || result.status === "cancelled") {
        const [error] = result.errors;
        setDocumentState({
          name: "failed",
          message: error?.message ?? "Document translation failed.",
          fileName: file.name,
          blocks: [],
        });
        return;
      }

      const blocks = composeTranslatedDocumentBlocks(sourceBlocks, result.translations);
      setDocumentState({
        name: "rendered",
        message: `Rendered ${blocks.length} bilingual document blocks.`,
        fileName: file.name,
        blocks,
      });
    } catch (error) {
      setDocumentState({
        name: "failed",
        message: error instanceof Error ? error.message : "Document translation failed.",
        fileName: file.name,
        blocks: [],
      });
    } finally {
      setDocumentBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async (): Promise<void> => {
      const settings = await localTranslationRepository.load();
      if (cancelled) return;
      setLocalSettings(settings);
      setLocalSettingsLoaded(true);
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const canTranslateDocument = localSettingsLoaded && localSettings.enabled && !documentBusy;

  return (
    <section className="max-w-full pt-3 text-[inherit]">
      <div className="surface-elevated rounded-lg p-4">
        <div className="text-[10px] uppercase tracking-[0.28em] text-(--muted-foreground)">
          provider settings
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold">Documents and local provider</div>
            <p className="mt-2 text-sm text-(--muted-foreground)">
              Configure the local provider, then use document translation as a secondary tool.
            </p>
          </div>
          <div
            className={cx(
              "shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
              localSettingsLoaded && localSettings.enabled
                ? "border-(--primary) bg-(--secondary) text-(--secondary-foreground)"
                : "border-(--border) text-(--muted-foreground)",
            )}
          >
            {localLabel(localSettingsLoaded, localSettings)}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-(--border) bg-(--card) p-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-(--muted-foreground)">
            Endpoint
          </div>
          <label className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-(--border) px-3 py-2 text-xs">
            <span>Enable local translation</span>
            <input
              type="checkbox"
              aria-label="Enable local translation"
              checked={localSettings.enabled}
              disabled={!localSettingsLoaded}
              onChange={(event) => patchLocalSettings({ enabled: event.currentTarget.checked })}
              className="h-4 w-4"
            />
          </label>
          <label className="mt-3 grid gap-1 text-xs text-(--muted-foreground)">
            Endpoint URL
            <input
              data-testid="provider-settings-local-endpoint"
              aria-label="Endpoint URL"
              value={localSettings.endpoint}
              disabled={!localSettings.enabled || !localSettingsLoaded}
              onChange={(event) => patchLocalSettings({ endpoint: event.currentTarget.value })}
              className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs font-semibold text-[inherit]"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-(--muted-foreground)">
              Source
              <input
                aria-label="Source language"
                value={localSettings.sourceLanguage}
                disabled={!localSettings.enabled || !localSettingsLoaded}
                onChange={(event) =>
                  patchLocalSettings({
                    sourceLanguage: event.currentTarget.value,
                  })
                }
                className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs font-semibold text-[inherit]"
              />
            </label>
            <label className="grid gap-1 text-xs text-(--muted-foreground)">
              Target
              <input
                aria-label="Target language"
                value={localSettings.targetLanguage}
                disabled={!localSettings.enabled || !localSettingsLoaded}
                onChange={(event) =>
                  patchLocalSettings({
                    targetLanguage: event.currentTarget.value,
                  })
                }
                className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs font-semibold text-[inherit]"
              />
            </label>
          </div>
          <label className="mt-3 grid gap-1 text-xs text-(--muted-foreground)">
            Optional API key
            <input
              aria-label="Optional API key"
              value={localSettings.apiKey}
              disabled={!localSettings.enabled || !localSettingsLoaded}
              type="password"
              onChange={(event) => patchLocalSettings({ apiKey: event.currentTarget.value })}
              className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs font-semibold text-[inherit]"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-(--muted-foreground)">
              Batch size
              <input
                aria-label="Batch size"
                value={localSettings.batchSize}
                disabled={!localSettings.enabled || !localSettingsLoaded}
                min="1"
                max="50"
                type="number"
                onChange={(event) => {
                  const batchSize = parsePositiveInteger(event.currentTarget.value);
                  if (batchSize) patchLocalSettings({ batchSize });
                }}
                className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs font-semibold text-[inherit]"
              />
            </label>
            <label className="grid gap-1 text-xs text-(--muted-foreground)">
              Cache min
              <input
                aria-label="Cache minutes"
                value={localSettings.cacheTtlMinutes}
                disabled={
                  !localSettings.enabled || !localSettings.cacheEnabled || !localSettingsLoaded
                }
                min="5"
                max="10080"
                type="number"
                onChange={(event) => {
                  const cacheTtlMinutes = parsePositiveInteger(event.currentTarget.value);
                  if (cacheTtlMinutes) patchLocalSettings({ cacheTtlMinutes });
                }}
                className="rounded-lg border border-(--border) bg-(--card) px-3 py-2 text-xs font-semibold text-[inherit]"
              />
            </label>
          </div>
          <label className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-(--border) px-3 py-2 text-xs">
            <span>Use local cache</span>
            <input
              type="checkbox"
              aria-label="Use local translation cache"
              checked={localSettings.cacheEnabled}
              disabled={!localSettings.enabled || !localSettingsLoaded}
              onChange={(event) =>
                patchLocalSettings({ cacheEnabled: event.currentTarget.checked })
              }
              className="h-4 w-4"
            />
          </label>
          <button
            type="button"
            onClick={() => void testLocalTranslation()}
            disabled={!localSettingsLoaded || !localSettings.enabled || localTranslationTesting}
            className={cx(
              "mt-3 w-full rounded-full border border-(--border) px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em]",
              localSettings.enabled
                ? "bg-(--primary) text-(--primary-foreground)"
                : "cursor-not-allowed text-(--muted-foreground)",
            )}
          >
            {localTranslationTesting ? "Testing endpoint..." : "Test endpoint"}
          </button>
          {localTranslationTestResult && (
            <div
              className={cx(
                "mt-3 rounded-lg border px-3 py-2 text-xs leading-5",
                localTranslationTestResult.ok
                  ? "border-(--primary) text-(--primary)"
                  : "border-(--destructive) text-(--destructive)",
              )}
            >
              {localTranslationTestResult.message}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-(--border) bg-(--card) p-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-(--muted-foreground)">
            Documents
          </div>
          <div className="mt-1 text-sm font-semibold">{documentLabel(documentState)}</div>
          <p className="mt-1 text-xs text-(--muted-foreground)">{documentState.message}</p>
          {documentState.fileName && (
            <div className="mt-2 truncate text-xs text-(--muted-foreground)">
              {documentState.fileName}
            </div>
          )}
          <label
            data-testid="document-tool-entry"
            className={cx(
              "mt-3 block rounded-full border border-(--border) px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.24em]",
              canTranslateDocument
                ? "cursor-pointer bg-(--primary) text-(--primary-foreground)"
                : "cursor-not-allowed text-(--muted-foreground)",
            )}
          >
            {documentBusy ? "Document run active..." : "Upload document"}
            <input
              type="file"
              accept=".docx,.epub,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip"
              disabled={!canTranslateDocument}
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = "";
                if (file) void translateDocument(file);
              }}
            />
          </label>
          {documentState.blocks.length > 0 && (
            <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-(--border) bg-(--popover) p-3">
              <div className="grid gap-3">
                {documentState.blocks.slice(0, 30).map((block) => (
                  <article
                    key={block.id}
                    className="rounded-lg border border-(--border) bg-(--card) p-3 text-xs leading-relaxed"
                  >
                    <p>{block.text}</p>
                    {block.translatedText && (
                      <p
                        lang={
                          localSettings.targetLanguage === "ko-en"
                            ? "und"
                            : localSettings.targetLanguage
                        }
                        className="mt-2 font-semibold"
                      >
                        {block.translatedText}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
