import { createServer, type Server } from "node:http";

const CALLBACK_SUCCESS_HTML = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Git Client authorization complete</title><body>Authorization complete. You can close this window and return to Git Client.</body></html>`;

export interface HostingOAuthLoopbackResult {
    readonly code?: string;
    readonly error?: string;
}

export interface HostingOAuthLoopbackSession {
    wait(signal: AbortSignal): Promise<HostingOAuthLoopbackResult>;
    close(): Promise<void>;
}

export interface HostingOAuthLoopbackFactory {
    open(
        redirectUri: string,
        expectedState: string,
    ): Promise<HostingOAuthLoopbackSession>;
}

function callbackUrl(value: string): URL {
    const url = new URL(value);
    if (
        url.protocol !== "http:" ||
        url.hostname !== "127.0.0.1" ||
        url.port.length === 0 ||
        url.username.length > 0 ||
        url.password.length > 0 ||
        url.search.length > 0 ||
        url.hash.length > 0
    ) {
        throw new Error(
            "GitLab OAuth redirect must be a credential-free http://127.0.0.1 URL with an explicit port",
        );
    }
    return url;
}

function closeServer(server: Server): Promise<void> {
    if (!server.listening) return Promise.resolve();
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

export class NodeHostingOAuthLoopbackFactory implements HostingOAuthLoopbackFactory {
    async open(
        redirectUri: string,
        expectedState: string,
    ): Promise<HostingOAuthLoopbackSession> {
        const redirect = callbackUrl(redirectUri);
        let settle: (result: HostingOAuthLoopbackResult) => void = () => {};
        const result = new Promise<HostingOAuthLoopbackResult>((resolve) => {
            settle = resolve;
        });
        let settled = false;
        const finish = (value: HostingOAuthLoopbackResult): void => {
            if (settled) return;
            settled = true;
            settle(value);
        };
        const server = createServer((request, response) => {
            const host = request.headers.host;
            if (host !== redirect.host) {
                response.writeHead(400, { "Content-Type": "text/plain" });
                response.end("Invalid callback host");
                return;
            }
            let received: URL;
            try {
                received = new URL(request.url ?? "", redirect.origin);
            } catch {
                response.writeHead(400, { "Content-Type": "text/plain" });
                response.end("Invalid callback URL");
                return;
            }
            if (
                request.method !== "GET" ||
                received.pathname !== redirect.pathname
            ) {
                response.writeHead(404, { "Content-Type": "text/plain" });
                response.end("Callback not found");
                return;
            }
            const states = received.searchParams.getAll("state");
            const codes = received.searchParams.getAll("code");
            const errors = received.searchParams.getAll("error");
            if (
                states.length !== 1 ||
                states[0] !== expectedState ||
                codes.length > 1 ||
                errors.length > 1 ||
                (codes.length === 1) === (errors.length === 1) ||
                (codes[0] !== undefined &&
                    (codes[0].length === 0 || codes[0].length > 16_384)) ||
                (errors[0] !== undefined &&
                    (errors[0].length === 0 || errors[0].length > 256))
            ) {
                response.writeHead(400, {
                    "Cache-Control": "no-store",
                    "Content-Type": "text/plain",
                });
                response.end("OAuth callback validation failed");
                finish({ error: "callback_validation_failed" });
                void closeServer(server).catch(() => {});
                return;
            }
            response.writeHead(200, {
                "Cache-Control": "no-store",
                "Content-Security-Policy": "default-src 'none'",
                "Content-Type": "text/html; charset=utf-8",
                "X-Content-Type-Options": "nosniff",
            });
            response.end(CALLBACK_SUCCESS_HTML);
            finish(
                codes.length === 1 ? { code: codes[0] } : { error: errors[0] },
            );
            void closeServer(server).catch(() => {});
        });

        await new Promise<void>((resolve, reject) => {
            const onError = (error: Error): void => {
                server.off("listening", onListening);
                reject(error);
            };
            const onListening = (): void => {
                server.off("error", onError);
                resolve();
            };
            server.once("error", onError);
            server.once("listening", onListening);
            server.listen(Number(redirect.port), "127.0.0.1");
        });

        return {
            wait(signal): Promise<HostingOAuthLoopbackResult> {
                if (signal.aborted)
                    return Promise.reject(new Error("OAuth was cancelled"));
                return new Promise((resolve, reject) => {
                    const abort = (): void => {
                        reject(new Error("OAuth was cancelled"));
                        void closeServer(server).catch(() => {});
                    };
                    signal.addEventListener("abort", abort, { once: true });
                    result.then((value) => {
                        signal.removeEventListener("abort", abort);
                        resolve(value);
                    }, reject);
                });
            },
            close: () => closeServer(server),
        };
    }
}
