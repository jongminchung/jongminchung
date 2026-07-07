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
  message: "DOCX 또는 EPUB 문서를 선택하면 원문과 번역문을 함께 표시합니다.",
  fileName: null,
  blocks: [],
};

const localTranslationRepository = LocalTranslationRepository.ofStorage(browser.storage.local);

function cx(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

function translationStatusLabel(loaded: boolean, settings: LocalTranslationSettings): string {
  if (!loaded) return "번역 준비 상태 확인 중";
  return settings.enabled ? "로컬 번역 준비됨" : "번역 꺼짐";
}

function documentLabel(state: DocumentTranslationState): string {
  if (state.name === "idle") return "문서 번역 대기 중";
  if (state.name === "reading") return "문서를 읽는 중";
  if (state.name === "translating") return "문서를 번역하는 중";
  if (state.name === "rendered") return "문서 번역 표시됨";
  return "문서 번역 실패";
}

export function DocumentTranslationPanel(): JSX.Element {
  const [localSettings, setLocalSettings] = useState<LocalTranslationSettings>(
    DEFAULT_LOCAL_TRANSLATION_SETTINGS,
  );
  const [localSettingsLoaded, setLocalSettingsLoaded] = useState(false);
  const [documentState, setDocumentState] = useState<DocumentTranslationState>(DOCUMENT_IDLE_STATE);
  const [documentBusy, setDocumentBusy] = useState(false);

  const translateDocument = useCallback(async (file: File): Promise<void> => {
    setDocumentBusy(true);
    setDocumentState({
      name: "reading",
      message: "문서를 읽는 중입니다.",
      fileName: file.name,
      blocks: [],
    });

    try {
      const settings = await localTranslationRepository.load();
      if (!settings.enabled) {
        setDocumentState({
          name: "failed",
          message: "번역 준비가 완료되지 않아 문서를 번역할 수 없습니다.",
          fileName: file.name,
          blocks: [],
        });
        return;
      }

      const sourceBlocks = await extractDocumentTextBlocks(file.name, await file.arrayBuffer());
      setDocumentState({
        name: "translating",
        message: "문서를 번역하는 중입니다.",
        fileName: file.name,
        blocks: [],
      });

      const result = await LocalTranslationService.runJob(
        settings,
        buildDocumentTranslationInputs(sourceBlocks),
        { repository: localTranslationRepository },
      );

      if (result.status === "failed" || result.status === "cancelled") {
        setDocumentState({
          name: "failed",
          message: "문서 번역에 실패했습니다.",
          fileName: file.name,
          blocks: [],
        });
        return;
      }

      const blocks = composeTranslatedDocumentBlocks(sourceBlocks, result.translations);
      setDocumentState({
        name: "rendered",
        message: "문서 번역이 표시되었습니다.",
        fileName: file.name,
        blocks,
      });
    } catch {
      setDocumentState({
        name: "failed",
        message: "문서 번역에 실패했습니다.",
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
          문서 번역
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-semibold">문서 번역</div>
            <p className="mt-2 text-sm text-(--muted-foreground)">
              한국어 문서는 영어로, 영어 문서는 한국어로 번역합니다.
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
            {translationStatusLabel(localSettingsLoaded, localSettings)}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-(--border) bg-(--card) p-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-(--muted-foreground)">
            파일
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
            {documentBusy ? "번역 중..." : "문서 선택"}
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
