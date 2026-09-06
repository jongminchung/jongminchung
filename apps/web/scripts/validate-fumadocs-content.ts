import {
  blogCollection,
  docsCollection,
  investmentCollection,
} from "../.source/server.ts";
import type {
  BlogPostMetadata,
  DocsPageMetadata,
} from "../lib/content-model.ts";
import {
  validateInvestmentNotes,
  validateTechContent,
  type ValidatedContentSource,
} from "../lib/content-validation.ts";
import type { InvestmentNoteMetadata } from "../lib/invest/content.ts";
import docsBaseline from "./tech-docs-baseline.json";

async function validateTech(): Promise<void> {
  const [blogSources, docsSources] = await Promise.all([
    Promise.all(
      blogCollection.map(
        async (entry): Promise<ValidatedContentSource<BlogPostMetadata>> => {
          const compiled = await entry.load();
          return {
            metadata: entry,
            body: await entry.getText("raw"),
            filePath: entry.info.fullPath,
            relativePath: entry.info.path,
            extractedReferences: compiled.extractedReferences ?? [],
          };
        },
      ),
    ),
    Promise.all(
      docsCollection.docs.map(
        async (entry): Promise<ValidatedContentSource<DocsPageMetadata>> => {
          const compiled = await entry.load();
          return {
            metadata: entry,
            body: await entry.getText("raw"),
            filePath: entry.info.fullPath,
            relativePath: entry.info.path,
            extractedReferences: compiled.extractedReferences ?? [],
          };
        },
      ),
    ),
  ]);
  validateTechContent(blogSources, docsSources, { requireAreas: true });
  for (const locale of ["ko", "en"] as const) {
    const paths = new Set(docsSources.map((page) => page.relativePath));
    const missing = docsBaseline.filter(
      (path) => !paths.has(`${locale}/${path}`),
    );
    if (missing.length > 0)
      throw new Error(
        `Docs ${locale} is missing baseline pages: ${missing.join(", ")}`,
      );
  }
}

async function validateInvestment(): Promise<void> {
  const sources = await Promise.all(
    investmentCollection.map(
      async (
        entry,
      ): Promise<ValidatedContentSource<InvestmentNoteMetadata>> => {
        const compiled = await entry.load();
        return {
          metadata: entry,
          body: await entry.getText("raw"),
          filePath: entry.info.fullPath,
          relativePath: entry.info.path,
          extractedReferences: compiled.extractedReferences ?? [],
        };
      },
    ),
  );
  validateInvestmentNotes(sources);
}

await Promise.all([validateTech(), validateInvestment()]);
process.stdout.write(
  `Validated ${blogCollection.length} blog posts, ${docsCollection.docs.length} docs pages, and ${investmentCollection.length} investment notes.\n`,
);
