import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    excalidrawSceneQueryOptions,
    searchIndexQueryOptions,
} from "./tech-queries";

const searchDocument = {
    id: "overview",
    locale: "en",
    section: "overview",
    title: "Overview",
    description: "Documentation overview",
    order: 0,
    href: "/en",
    headings: ["Start"],
    tags: ["docs"],
    apiSymbols: [],
    body: "Overview body",
} as const;

function createScene(): string {
    return JSON.stringify({
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [
            {
                id: "text-1",
                type: "text",
                x: 0,
                y: 0,
                width: 100,
                height: 20,
                text: "query cache",
            },
        ],
        appState: {},
        files: {},
    });
}

function createClient(): QueryClient {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
}

afterEach(() => vi.unstubAllGlobals());

describe("searchIndexQueryOptions", () => {
    it("separates locale keys and parses the response contract", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => Response.json([searchDocument])),
        );
        const client = createClient();

        expect(searchIndexQueryOptions("en").queryKey).toEqual([
            "tech",
            "search-index",
            "en",
        ]);
        expect(searchIndexQueryOptions("ko").queryKey).toEqual([
            "tech",
            "search-index",
            "ko",
        ]);
        await expect(
            client.fetchQuery(searchIndexQueryOptions("en")),
        ).resolves.toEqual([searchDocument]);
    });

    it("rejects HTTP and Zod contract failures", async () => {
        const client = createClient();
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(
                Response.json([{ ...searchDocument, extra: true }]),
            );
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            client.fetchQuery(searchIndexQueryOptions("en")),
        ).rejects.toThrow("503");
        await expect(
            client.fetchQuery(searchIndexQueryOptions("ko")),
        ).rejects.toThrow("invalid data");
    });
});

describe("excalidrawSceneQueryOptions", () => {
    it("forwards the query signal and caches a scene by source", async () => {
        let receivedSignal: AbortSignal | undefined;
        const fetchMock = vi.fn(
            async (_input: RequestInfo | URL, init?: RequestInit) => {
                receivedSignal = init?.signal ?? undefined;
                return new Response(createScene());
            },
        );
        vi.stubGlobal("fetch", fetchMock);
        const client = createClient();
        const options = excalidrawSceneQueryOptions(
            "/diagrams/query-cache.excalidraw",
        );

        const first = await client.fetchQuery(options);
        const second = await client.fetchQuery(options);

        expect(first).toBe(second);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });
});
