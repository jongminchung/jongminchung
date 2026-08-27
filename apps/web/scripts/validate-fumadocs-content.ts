import { investmentCollection, techCollection } from "../.source/server.ts";
import type { DocMetadata } from "../lib/content-model.ts";
import {
  validateDocuments,
  validateInvestmentNotes,
  type ValidatedContentSource,
} from "../lib/content-validation.ts";
import type { InvestmentNoteMetadata } from "../lib/invest/content.ts";

async function validateTech(): Promise<void> {
  const sources = await Promise.all(
    techCollection.map(
      async (entry): Promise<ValidatedContentSource<DocMetadata>> => {
        const compiled = await entry.load();
        const raw = await entry.getText("raw");
        return {
          metadata: entry,
          body: raw,
          filePath: entry.info.fullPath,
          relativePath: entry.info.path,
          extractedReferences: compiled.extractedReferences ?? [],
        };
      },
    ),
  );
  validateDocuments(sources);
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
  `Validated ${techCollection.length} technical documents and ${investmentCollection.length} investment notes.\n`,
);
