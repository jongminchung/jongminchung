import { execFileSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpsServer } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

const EXECUTABLE_PATH = resolve(
    "out/Git Client-darwin-arm64/Git Client.app/Contents/MacOS/Git Client",
);

export const HOSTING_PROFILE_NAME = "Git Client Electron QA Hosting";

export interface SanitizedHostingRequest {
    readonly credentialAccepted: boolean;
    readonly method: string;
    readonly path: string;
    readonly provider: "gitHub" | "gitLab";
}

export interface LoopbackHostingServer {
    readonly baseUrl: string;
    readonly certificatePath: string;
    requests(): readonly SanitizedHostingRequest[];
    close(): Promise<void>;
}

export interface PackagedHostingApp {
    readonly page: Page;
    outputContainsCredential(credentials: readonly string[]): boolean;
    close(): Promise<void>;
}

function profilePath(): string {
    return join(
        homedir(),
        "Library",
        "Application Support",
        HOSTING_PROFILE_NAME,
    );
}

export async function resetHostingProfile(): Promise<void> {
    await rm(profilePath(), { recursive: true, force: true });
}

export async function inspectHostingProfile(
    credentials: readonly string[],
): Promise<{
    readonly credentialCount: number;
    readonly containsCredential: boolean;
}> {
    const settings = await readFile(
        join(profilePath(), "settings.json"),
        "utf8",
    );
    return {
        credentialCount: settings.match(/"hostingCredential:/gu)?.length ?? 0,
        containsCredential: credentials.some((credential) =>
            settings.includes(credential),
        ),
    };
}

async function freePort(): Promise<number> {
    const server = createTcpServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
        server.close();
        throw new Error("Unable to reserve a loopback port");
    }
    const port = address.port;
    server.close();
    await once(server, "close");
    return port;
}

function respond(
    response: ServerResponse,
    status: number,
    body: unknown,
): void {
    const encoded = JSON.stringify(body);
    response.writeHead(status, {
        "content-length": Buffer.byteLength(encoded),
        "content-type": "application/json",
    });
    response.end(encoded);
}

function gitHubChangeRequest(): Readonly<Record<string, unknown>> {
    return {
        number: 7,
        title: "Packaged GitHub request",
        state: "open",
        user: { login: "github-qa" },
        head: { ref: "feature/github" },
        base: { ref: "main" },
        html_url: "https://example.invalid/owner/repo/pull/7",
        draft: false,
        updated_at: "2026-07-19T00:00:00Z",
    };
}

function gitLabChangeRequest(): Readonly<Record<string, unknown>> {
    return {
        iid: 11,
        title: "Packaged GitLab request",
        state: "opened",
        author: { username: "gitlab-qa" },
        source_branch: "feature/gitlab",
        target_branch: "main",
        web_url: "https://example.invalid/group/repo/-/merge_requests/11",
        draft: false,
        updated_at: "2026-07-19T00:00:00Z",
    };
}

async function createCertificate(
    directory: string,
): Promise<{ readonly certificatePath: string; readonly keyPath: string }> {
    const certificatePath = join(directory, "loopback-cert.pem");
    const keyPath = join(directory, "loopback-key.pem");
    const configPath = join(directory, "openssl.cnf");
    await writeFile(
        configPath,
        [
            "[req]",
            "distinguished_name = subject",
            "x509_extensions = extensions",
            "prompt = no",
            "[subject]",
            "CN = 127.0.0.1",
            "[extensions]",
            "subjectAltName = IP:127.0.0.1",
            "basicConstraints = critical,CA:TRUE",
            "keyUsage = critical,digitalSignature,keyEncipherment,keyCertSign",
        ].join("\n"),
        "utf8",
    );
    execFileSync(
        "/usr/bin/openssl",
        [
            "req",
            "-x509",
            "-nodes",
            "-newkey",
            "rsa:2048",
            "-days",
            "1",
            "-keyout",
            keyPath,
            "-out",
            certificatePath,
            "-config",
            configPath,
        ],
        { stdio: "ignore" },
    );
    return { certificatePath, keyPath };
}

export async function startLoopbackHostingServer(
    gitHubCredential: string,
    gitLabCredential: string,
): Promise<LoopbackHostingServer> {
    const directory = await mkdtemp(join(tmpdir(), "git-client-hosting-e2e-"));
    const { certificatePath, keyPath } = await createCertificate(directory);
    const [certificate, key] = await Promise.all([
        readFile(certificatePath),
        readFile(keyPath),
    ]);
    const captured: SanitizedHostingRequest[] = [];
    const server = createHttpsServer(
        { cert: certificate, key },
        (request, response) => {
            handleHostingRequest(
                request,
                response,
                gitHubCredential,
                gitLabCredential,
                captured,
            );
        },
    );
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
        server.close();
        await rm(directory, { recursive: true, force: true });
        throw new Error("Loopback hosting server did not bind to a TCP port");
    }
    let closed = false;
    return {
        baseUrl: `https://127.0.0.1:${address.port}`,
        certificatePath,
        requests: () => captured.map((request) => ({ ...request })),
        async close(): Promise<void> {
            if (closed) return;
            closed = true;
            server.close();
            await once(server, "close");
            await rm(directory, { recursive: true, force: true });
        },
    };
}

function handleHostingRequest(
    request: IncomingMessage,
    response: ServerResponse,
    gitHubCredential: string,
    gitLabCredential: string,
    captured: SanitizedHostingRequest[],
): void {
    request.resume();
    const url = new URL(request.url ?? "/", "https://127.0.0.1");
    const provider = url.pathname.startsWith("/api/v3/")
        ? "gitHub"
        : url.pathname.startsWith("/api/v4/")
          ? "gitLab"
          : null;
    if (provider === null) {
        respond(response, 404, { message: "Unknown mock hosting API" });
        return;
    }
    const credentialAccepted =
        provider === "gitHub"
            ? request.headers.authorization === `Bearer ${gitHubCredential}` &&
              request.headers["private-token"] === undefined
            : request.headers["private-token"] === gitLabCredential &&
              request.headers.authorization === undefined;
    captured.push({
        credentialAccepted,
        method: request.method ?? "",
        path: `${url.pathname}${url.search}`,
        provider,
    });
    if (!credentialAccepted) {
        respond(response, 401, {
            message: "Mock hosting credential was rejected",
        });
        return;
    }
    if (provider === "gitHub" && url.pathname === "/api/v3/user") {
        respond(response, 200, { login: "github-qa" });
        return;
    }
    if (provider === "gitLab" && url.pathname === "/api/v4/user") {
        respond(response, 200, { username: "gitlab-qa" });
        return;
    }
    if (
        provider === "gitHub" &&
        url.pathname === "/api/v3/repos/owner/error/pulls"
    ) {
        respond(response, 401, {
            message: `token=${gitHubCredential} Authorization: Bearer ${gitHubCredential}`,
        });
        return;
    }
    if (
        provider === "gitHub" &&
        url.pathname === "/api/v3/repos/owner/repo/pulls"
    ) {
        respond(response, 200, [gitHubChangeRequest()]);
        return;
    }
    if (
        provider === "gitLab" &&
        url.pathname === "/api/v4/projects/group%2Frepo/merge_requests"
    ) {
        respond(response, 200, [gitLabChangeRequest()]);
        return;
    }
    respond(response, 404, { message: "Unknown mock hosting route" });
}

export async function launchPackagedHosting(
    certificatePath: string,
): Promise<PackagedHostingApp> {
    const port = await freePort();
    const child = spawn(
        EXECUTABLE_PATH,
        [
            "--qa-hosting-profile",
            `--qa-hosting-certificate=${certificatePath}`,
            `--remote-debugging-port=${port}`,
        ],
        {
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
        stream.setEncoding("utf8");
        stream.on("data", (chunk: string) => {
            output = `${output}${chunk}`.slice(-1_000_000);
        });
    }

    let browser: Browser | null = null;
    const deadline = Date.now() + 12_000;
    while (browser === null && Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(
                `Git Client exited before its CDP endpoint was ready (${child.exitCode})`,
            );
        }
        try {
            browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        } catch {
            await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
        }
    }
    if (browser === null) {
        child.kill("SIGKILL");
        throw new Error("Git Client CDP endpoint did not start");
    }
    const context = browser.contexts()[0];
    if (context === undefined) {
        await browser.close();
        await stopChild(child);
        throw new Error("Git Client did not create a browser context");
    }
    const page = context.pages()[0] ?? (await context.waitForEvent("page"));
    try {
        await page.waitForLoadState("domcontentloaded");
        await page.waitForFunction(
            () => {
                const api: unknown = Reflect.get(window, "gitClient");
                return (
                    typeof api === "object" &&
                    api !== null &&
                    typeof Reflect.get(api, "hosting") === "object"
                );
            },
            undefined,
            { timeout: 12_000 },
        );
    } catch {
        await browser.close().catch(() => undefined);
        await stopChild(child);
        throw new Error(
            "Git Client hosting preload API did not become available",
        );
    }
    let closed = false;
    return {
        page,
        outputContainsCredential: (credentials) =>
            credentials.some((credential) => output.includes(credential)),
        async close(): Promise<void> {
            if (closed) return;
            closed = true;
            await browser?.close().catch(() => undefined);
            await stopChild(child);
        },
    };
}

async function stopChild(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    const exited = once(child, "exit").then(() => true);
    const timedOut = new Promise<false>((resolveTimeout) => {
        setTimeout(() => resolveTimeout(false), 2_000);
    });
    if (await Promise.race([exited, timedOut])) return;
    child.kill("SIGKILL");
    await once(child, "exit");
}
