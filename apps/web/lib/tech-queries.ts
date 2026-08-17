import { queryOptions } from "@tanstack/react-query";
import { searchDocumentSchema, type Locale } from "./content-model.ts";
import {
    parseExcalidrawAssetSrc,
    parseExcalidrawSource,
} from "./excalidraw-scene.ts";

export function searchIndexQueryOptions(locale: Locale) {
    return queryOptions({
        queryKey: ["tech", "search-index", locale] as const,
        queryFn: async ({ signal }) => {
            const response = await fetch(`/search/${locale}.json`, { signal });
            if (!response.ok)
                throw new Error(
                    `Search index request failed with ${response.status}.`,
                );
            const result = searchDocumentSchema
                .array()
                .readonly()
                .safeParse(await response.json());
            if (!result.success)
                throw new Error("Search index contains invalid data.");
            return result.data;
        },
        gcTime: Infinity,
        staleTime: Infinity,
    });
}

export function excalidrawSceneQueryOptions(src: string) {
    return queryOptions({
        queryKey: ["tech", "excalidraw-scene", src] as const,
        queryFn: async ({ signal }) => {
            parseExcalidrawAssetSrc(src);
            const response = await fetch(src, { signal });
            if (!response.ok)
                throw new Error(
                    `Excalidraw source request failed with ${response.status}.`,
                );
            return parseExcalidrawSource(await response.text(), src);
        },
        gcTime: Infinity,
        staleTime: Infinity,
    });
}
