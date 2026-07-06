import type { TranslationInput, TranslationOutput } from "./local-translation";

export type WebpageDisplayMode = "original" | "translated" | "bilingual";

export interface WebpageTextBlockDraft {
  readonly id?: string;
  readonly index?: number;
  readonly tagName?: string;
  readonly text: string;
}

export interface WebpageTextBlock {
  readonly id: string;
  readonly index: number;
  readonly tagName: string;
  readonly text: string;
}

export interface TranslatedWebpageTextBlock extends WebpageTextBlock {
  readonly translatedText: string | null;
  readonly displayText: string;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeTagName(tagName: string | undefined): string {
  const normalized = tagName?.trim().toLowerCase() ?? "";
  return normalized || "div";
}

function hashStableId(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function blockId(index: number, tagName: string, text: string): string {
  return `webpage-block-${index}-${hashStableId(`${tagName}:${text}`)}`;
}

export function isWebpageDisplayMode(value: unknown): value is WebpageDisplayMode {
  return value === "original" || value === "translated" || value === "bilingual";
}

export function normalizeReadableTextBlocks(
  drafts: readonly WebpageTextBlockDraft[],
): readonly WebpageTextBlock[] {
  return drafts.flatMap((draft, sourceIndex) => {
    const text = normalizeWhitespace(draft.text);
    if (!text) return [];
    const index =
      typeof draft.index === "number" && Number.isInteger(draft.index) && draft.index >= 0
        ? draft.index
        : sourceIndex;
    const tagName = normalizeTagName(draft.tagName);
    const id = draft.id?.trim() || blockId(index, tagName, text);
    return [{ id, index, tagName, text }];
  });
}

export function buildWebpageTranslationInputs(
  blocks: readonly WebpageTextBlock[],
): readonly TranslationInput[] {
  return blocks.map((block) => ({ id: block.id, text: block.text, format: "text" }));
}

export function composeTranslatedWebpageBlocks(
  blocks: readonly WebpageTextBlock[],
  translations: readonly TranslationOutput[],
): readonly TranslatedWebpageTextBlock[] {
  const translationsById = new Map(
    translations.map((translation) => [translation.id, translation.text]),
  );
  return blocks.map((block) => {
    const translatedText = translationsById.get(block.id)?.trim() || null;
    return {
      ...block,
      translatedText,
      displayText: translatedText ?? block.text,
    };
  });
}

export function webpageDisplayText(
  block: TranslatedWebpageTextBlock,
  mode: WebpageDisplayMode,
): string {
  if (mode === "original") return block.text;
  if (mode === "translated") return block.translatedText ?? block.text;
  return block.translatedText
    ? `${block.text}
${block.translatedText}`
    : block.text;
}
