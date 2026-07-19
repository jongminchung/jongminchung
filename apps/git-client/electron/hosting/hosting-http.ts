import { HostingFoundationError } from "./hosting-error";

export type HostingHttpMethod = "GET" | "POST" | "PUT";

export interface HostingHttpRequest {
  readonly method: HostingHttpMethod;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
  readonly signal: AbortSignal;
  readonly maxResponseBytes: number;
}

export interface HostingHttpResponse {
  readonly status: number;
  readonly statusText: string;
  readonly body: Uint8Array;
}

export interface HostingHttpClient {
  send(request: HostingHttpRequest): Promise<HostingHttpResponse>;
}

async function readLimitedBody(response: Response, limit: number): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declaredLength) && declaredLength > limit) {
      throw new HostingFoundationError(
        "responseTooLarge",
        `Hosting response exceeds the ${limit} byte limit`,
      );
    }
  }
  if (response.body === null) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > limit) {
      await reader.cancel("hosting response size limit exceeded");
      throw new HostingFoundationError(
        "responseTooLarge",
        `Hosting response exceeds the ${limit} byte limit`,
      );
    }
    chunks.push(result.value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export class FetchHostingHttpClient implements HostingHttpClient {
  readonly #fetchImplementation: typeof fetch;

  private constructor(fetchImplementation: typeof fetch) {
    this.#fetchImplementation = fetchImplementation;
  }

  static of(fetchImplementation: typeof fetch = globalThis.fetch): FetchHostingHttpClient {
    return new FetchHostingHttpClient(fetchImplementation);
  }

  async send(request: HostingHttpRequest): Promise<HostingHttpResponse> {
    const response = await this.#fetchImplementation(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ?? undefined,
      signal: request.signal,
      redirect: "manual",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel("hosting redirects are disabled");
      throw new HostingFoundationError("redirect", "Hosting redirects are disabled");
    }
    return Object.freeze({
      status: response.status,
      statusText: response.statusText,
      body: await readLimitedBody(response, request.maxResponseBytes),
    });
  }
}
