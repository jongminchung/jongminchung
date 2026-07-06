import JSZip from "jszip";
import type { TranslationInput, TranslationOutput } from "./local-translation";

export type DocumentFileKind = "docx" | "epub";

export interface DocumentTextBlock {
  readonly id: string;
  readonly index: number;
  readonly text: string;
}

export interface TranslatedDocumentTextBlock extends DocumentTextBlock {
  readonly translatedText: string | null;
}

export class DocumentTranslationError extends Error {
  readonly code: "unsupported_file" | "empty_document" | "parse_failed";

  constructor(code: DocumentTranslationError["code"], message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DocumentTranslationError";
    this.code = code;
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripXmlTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function blockId(index: number, text: string): string {
  let hash = 0x811c9dc5;
  for (let position = 0; position < text.length; position += 1) {
    hash ^= text.charCodeAt(position);
    hash = Math.imul(hash, 0x01000193);
  }
  return `document-block-${index}-${(hash >>> 0).toString(36)}`;
}

function toBlocks(texts: readonly string[]): readonly DocumentTextBlock[] {
  return texts.flatMap((text, sourceIndex) => {
    const normalized = normalizeWhitespace(text);
    if (!normalized) return [];
    return [{ id: blockId(sourceIndex, normalized), index: sourceIndex, text: normalized }];
  });
}

export function documentKindFromFileName(fileName: string): DocumentFileKind | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".docx")) return "docx";
  if (normalized.endsWith(".epub")) return "epub";
  return null;
}

function splitDocxParagraphs(xml: string): readonly string[] {
  return xml.split(/<\/w:p>/).map((paragraph) =>
    Array.from(paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
      .map((match) => match[1] ?? "")
      .join(""),
  );
}

async function extractDocxBlocks(data: ArrayBuffer): Promise<readonly DocumentTextBlock[]> {
  const zip = await JSZip.loadAsync(data);
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) {
    throw new DocumentTranslationError(
      "parse_failed",
      "DOCX file did not include word/document.xml.",
    );
  }
  return toBlocks(splitDocxParagraphs(await documentXml.async("text")).map(stripXmlTags));
}

async function extractEpubBlocks(data: ArrayBuffer): Promise<readonly DocumentTextBlock[]> {
  const zip = await JSZip.loadAsync(data);
  const textFiles = Object.values(zip.files)
    .filter((file) => !file.dir && /\.(xhtml|html|htm)$/i.test(file.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const texts: string[] = [];

  for (const file of textFiles) {
    const markup = await file.async("text");
    const body = markup.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? markup;
    texts.push(...body.split(/<\/(?:p|h[1-6]|li|blockquote|section|div)>/i).map(stripXmlTags));
  }

  return toBlocks(texts);
}

export async function extractDocumentTextBlocks(
  fileName: string,
  data: ArrayBuffer,
): Promise<readonly DocumentTextBlock[]> {
  const kind = documentKindFromFileName(fileName);
  if (!kind) {
    throw new DocumentTranslationError("unsupported_file", "Upload a DOCX or EPUB document.");
  }

  try {
    const blocks = kind === "docx" ? await extractDocxBlocks(data) : await extractEpubBlocks(data);
    if (blocks.length === 0) {
      throw new DocumentTranslationError("empty_document", "No readable document text was found.");
    }
    return blocks;
  } catch (error) {
    if (error instanceof DocumentTranslationError) throw error;
    throw new DocumentTranslationError("parse_failed", "Could not parse the document.", error);
  }
}

export function buildDocumentTranslationInputs(
  blocks: readonly DocumentTextBlock[],
): readonly TranslationInput[] {
  return blocks.map((block) => ({ id: block.id, text: block.text, format: "text" }));
}

export function composeTranslatedDocumentBlocks(
  blocks: readonly DocumentTextBlock[],
  translations: readonly TranslationOutput[],
): readonly TranslatedDocumentTextBlock[] {
  const translatedById = new Map(
    translations.map((translation) => [translation.id, translation.text]),
  );
  return blocks.map((block) => ({
    ...block,
    translatedText: translatedById.get(block.id)?.trim() || null,
  }));
}
