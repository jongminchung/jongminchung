import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "fumadocs-mdx/node";
import type { MDXComponents } from "mdx/types";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Match the Node runtime used by Next's MDX compilation workers.
register();
const components = Object.fromEntries(
  [
    "Highlight",
    "MarkdownAlert",
    "Details",
    "Summary",
    "Glossary",
    "Term",
    "Definition",
    "CodeExample",
    "CodeNotes",
    "CodeNote",
    "Comparison",
    "ComparisonItem",
    "ExpectedResult",
  ].map((name) => [name, `reading-${name.toLowerCase()}`]),
) as MDXComponents;
const directory = await mkdtemp(
  join(import.meta.dirname, "../.tmp-reading-roundtrip-"),
);
try {
  for (const locale of ["ko", "en"]) {
    await mkdir(join(directory, locale));
    const fixtureDir = join(import.meta.dirname, "../fixtures/reading", locale);
    const files = (await readdir(fixtureDir)).filter((file) =>
      file.endsWith(".mdx"),
    );
    assert.equal(files.length, 8);
    for (const file of files) {
      const originalPath = join(fixtureDir, file);
      const original = await readFile(originalPath, "utf8");
      const module = (await import(
        `${pathToFileURL(originalPath).href}?collection=readingSamples`
      )) as {
        default: ComponentType<{ components: MDXComponents }>;
        readingSource: string;
      };
      const end = original.indexOf("---", 3) + 4;
      assert.equal(module.readingSource, original.slice(end));
      const copiedPath = join(directory, locale, file);
      // Document metadata is supplied independently of the copied MDX body.
      await writeFile(
        copiedPath,
        original.slice(0, end) + module.readingSource,
      );
      const copied = (await import(
        `${pathToFileURL(copiedPath).href}?collection=readingSamples`
      )) as typeof module;
      const render = (Content: typeof module.default) =>
        renderToStaticMarkup(createElement(Content, { components }));
      assert.equal(
        render(copied.default),
        render(module.default),
        `${locale}/${file}`,
      );
    }
  }
  console.log("Verified all 16 MDX source exports and recompilations.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
