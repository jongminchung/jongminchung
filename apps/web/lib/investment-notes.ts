import { z } from "zod";
import {
    investmentLoaders,
    type InvestmentLoaderKey,
} from "../generated/investment-loaders";
import manifestData from "../generated/investment-manifest.json";
import type { Locale } from "./content-contracts";
import {
    createInvestmentNoteHref,
    investmentNoteManifestEntrySchema,
    type InvestmentNoteManifestEntry,
    type InvestmentSourceKind,
} from "./investment-content";

function parseManifest(value: unknown): readonly InvestmentNoteManifestEntry[] {
    const result = z
        .array(investmentNoteManifestEntrySchema)
        .readonly()
        .safeParse(value);
    if (!result.success)
        throw new Error(
            `Invalid investment manifest: ${result.error.issues[0]?.message ?? "unknown error"}`,
        );
    for (const [index, entry] of result.data.entries()) {
        if (entry.href !== createInvestmentNoteHref(entry.locale, entry.id))
            throw new Error(
                `Investment manifest item ${index} has an invalid href.`,
            );
    }
    return result.data;
}

export const investmentNotes = parseManifest(manifestData);

export function getInvestmentNotes(
    locale: Locale,
): readonly InvestmentNoteManifestEntry[] {
    return investmentNotes
        .filter((note) => note.locale === locale && note.status === "published")
        .toSorted(
            (left, right) =>
                right.publishedAt.localeCompare(left.publishedAt) ||
                left.id.localeCompare(right.id),
        );
}

export function getNotesBySource(
    locale: Locale,
    kind: InvestmentSourceKind,
): readonly InvestmentNoteManifestEntry[] {
    return getInvestmentNotes(locale).filter((note) =>
        note.sources.some((source) => source.kind === kind),
    );
}

export function findInvestmentNote(
    locale: Locale,
    id: string,
): InvestmentNoteManifestEntry | null {
    return getInvestmentNotes(locale).find((note) => note.id === id) ?? null;
}

export async function loadInvestmentNote(locale: Locale, id: string) {
    const metadata = findInvestmentNote(locale, id);
    if (metadata === null) return null;
    const key = `${locale}/${id}` as InvestmentLoaderKey;
    const loader = investmentLoaders[key];
    if (loader === undefined) return null;
    const module = await loader();
    return Object.freeze({ metadata, Content: module.default });
}
