import JSZip from "jszip";
import { describe, expect, test } from "vitest";
import {
  buildDocumentTranslationInputs,
  composeTranslatedDocumentBlocks,
  documentKindFromFileName,
  extractDocumentTextBlocks,
} from "./document-translation";

async function createDocxBuffer(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<w:document>
            <w:body>
                <w:p><w:r><w:t>Hello document</w:t></w:r></w:p>
                <w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>
            </w:body>
        </w:document>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

async function createEpubBuffer(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "OPS/chapter.xhtml",
    `<html><body>
            <h1>Chapter title</h1>
            <p>EPUB paragraph &amp; entity</p>
        </body></html>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("document translation model", () => {
  test("detects supported document file kinds", () => {
    expect(documentKindFromFileName("sample.pdf")).toBe(null);
    expect(documentKindFromFileName("sample.docx")).toBe("docx");
    expect(documentKindFromFileName("sample.epub")).toBe("epub");
    expect(documentKindFromFileName("sample.txt")).toBe(null);
  });

  test("extracts DOCX paragraphs into stable translation inputs", async () => {
    const blocks = await extractDocumentTextBlocks("sample.docx", await createDocxBuffer());

    expect(blocks.map((block) => block.text)).toEqual(["Hello document", "Second paragraph"]);
    expect(buildDocumentTranslationInputs(blocks)).toEqual([
      { id: blocks[0]?.id, text: "Hello document", format: "text" },
      { id: blocks[1]?.id, text: "Second paragraph", format: "text" },
    ]);
  });

  test("extracts EPUB html text and composes bilingual blocks", async () => {
    const blocks = await extractDocumentTextBlocks("sample.epub", await createEpubBuffer());
    const translated = composeTranslatedDocumentBlocks(blocks, [
      { id: blocks[0]?.id ?? "", text: "챕터 제목" },
      { id: blocks[1]?.id ?? "", text: "전자책 문단과 엔티티" },
    ]);

    expect(blocks.map((block) => block.text)).toEqual(["Chapter title", "EPUB paragraph & entity"]);
    expect(translated.map((block) => block.translatedText)).toEqual([
      "챕터 제목",
      "전자책 문단과 엔티티",
    ]);
  });

  test("rejects unsupported document files clearly", async () => {
    await expect(extractDocumentTextBlocks("notes.txt", new ArrayBuffer(0))).rejects.toThrow(
      "Upload a DOCX or EPUB document.",
    );
  });
});
