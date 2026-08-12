import { createServer } from "node:http";
import { compile } from "@mdx-js/mdx";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRemarkPluginImplementations } from "./remark-plugins.mjs";

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>';
const requests = [];
let krokiServer;
let krokiServerUrl;

beforeAll(async () => {
  krokiServer = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
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
  await new Promise((resolve) => krokiServer.listen(0, "127.0.0.1", resolve));
  const address = krokiServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected the Kroki test server to listen on a TCP port");
  }
  krokiServerUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    krokiServer.close((error) => (error === undefined ? resolve() : reject(error)));
  });
});

async function compileMdx(source) {
  return String(
    await compile(source, {
      remarkPlugins: createRemarkPluginImplementations({ krokiServer: krokiServerUrl }),
    }),
  );
}

describe("Engineering Docs PlantUML pipeline", () => {
  it("renders plantuml fences through Kroki with accessible alternative text", async () => {
    const source = '```plantuml alt="Request flow"\nAlice -> Bob: hello\n```';
    const output = await compileMdx(source);

    expect(requests.at(-1)).toEqual({
      body: "Alice -> Bob: hello",
      method: "POST",
      url: "/plantuml/svg",
    });
    expect(output).toContain("Request flow");
    expect(output).toContain(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  });

  it("leaves puml fences as ordinary code blocks", async () => {
    const requestCount = requests.length;
    const output = await compileMdx("```puml\nAlice -> Bob\n```");

    expect(requests).toHaveLength(requestCount);
    expect(output).toContain("language-puml");
  });

  it("keeps compilation available when Kroki returns an error image", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const output = await compileMdx("```plantuml\nserver failure\n```");
      expect(output).toContain("data:image/svg+xml;base64,");
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
