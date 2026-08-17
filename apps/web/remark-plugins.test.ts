import { createServer, type Server } from "node:http";
import { compile } from "@mdx-js/mdx";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRemarkPluginImplementations } from "./remark-plugins.ts";

const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>';
interface KrokiRequest {
    readonly body: string;
    readonly method?: string;
    readonly url?: string;
}

const requests: KrokiRequest[] = [];
let krokiServer: Server;
let krokiServerUrl: string;

beforeAll(async () => {
    krokiServer = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            requests.push({ body, method: request.method, url: request.url });
            if (body.includes("server failure")) {
                response.writeHead(503, { "content-type": "text/plain" });
                response.end("unavailable");
                return;
            }
            response.writeHead(200, { "content-type": "image/svg+xml" });
            response.end(svg);
        });
    });
    await new Promise<void>((resolve) =>
        krokiServer.listen(0, "127.0.0.1", resolve),
    );
    const address = krokiServer.address();
    if (address === null || typeof address === "string") {
        throw new Error(
            "Expected the Kroki test server to listen on a TCP port",
        );
    }
    krokiServerUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
        krokiServer.close((error) =>
            error === undefined ? resolve() : reject(error),
        );
    });
});

async function compileMdx(source: string): Promise<string> {
    return String(
        await compile(source, {
            remarkPlugins: createRemarkPluginImplementations({
                krokiServer: krokiServerUrl,
            }),
        }),
    );
}

describe("엔지니어링 엔지니어링 플랜트UML 파이프라인", () => {
    it("[성공] 대체 기능을 사용하여 Kroki를 통해 plantuml 외장을 백업함", async () => {
        const source =
            '```plantuml alt="Request flow"\nAlice -> Bob: hello\n```';
        const output = await compileMdx(source);

        expect(requests.at(-1)).toEqual({
            body: "Alice -> Bob: hello",
            method: "POST",
            url: "/plantuml/svg",
        });
        expect(output).toContain("Request flow");
        expect(output).toContain(
            `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
        );
    });

    it("[실패] Puml 충전을 일반 코드 블록으로 남겨두겠습니다", async () => {
        const requestCount = requests.length;
        const output = await compileMdx("```puml\nAlice -> Bob\n```");

        expect(requests).toHaveLength(requestCount);
        expect(output).toContain("language-puml");
    });

    it("[성공] Kroki가 오류를 범할 때 계속해서 사용할 수 있음", async () => {
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        try {
            const output = await compileMdx("```plantuml\nserver failure\n```");
            expect(output).toContain("data:image/svg+xml;base64,");
            expect(consoleError).toHaveBeenCalled();
        } finally {
            consoleError.mockRestore();
        }
    });
});
