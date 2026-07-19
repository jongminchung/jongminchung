import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { rm } from "node:fs/promises";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

const executablePath = resolve(
    "out/Git Client-darwin-arm64/Git Client.app/Contents/MacOS/Git Client",
);

export const runtimeProfileName = "Git Client Electron QA Runtime";

export interface PackagedApp {
    readonly page: Page;
    close(): Promise<void>;
}

export async function resetQaProfile(profileName: string): Promise<void> {
    await rm(join(homedir(), "Library", "Application Support", profileName), {
        recursive: true,
        force: true,
    });
}

async function freePort(): Promise<number> {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
        server.close();
        throw new Error("Unable to reserve a CDP port");
    }
    const port = address.port;
    server.close();
    await once(server, "close");
    return port;
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

export async function launchPackaged(
    args: readonly string[],
): Promise<PackagedApp> {
    const port = await freePort();
    const child = spawn(
        executablePath,
        [...args, `--remote-debugging-port=${port}`],
        { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
    });

    let browser: Browser | null = null;
    const deadline = Date.now() + 12_000;
    while (browser === null && Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(
                `Git Client exited before CDP was ready (${child.exitCode}): ${stderr}`,
            );
        }
        try {
            browser = await chromium.connectOverCDP(
                `http://127.0.0.1:${port}`,
            );
        } catch {
            await new Promise((resolveDelay) =>
                setTimeout(resolveDelay, 100),
            );
        }
    }
    if (browser === null) {
        child.kill("SIGKILL");
        throw new Error(`Git Client CDP endpoint did not start: ${stderr}`);
    }
    const context = browser.contexts()[0];
    if (context === undefined) {
        await browser.close();
        child.kill("SIGKILL");
        throw new Error("Git Client did not create a browser context");
    }
    const page = context.pages()[0] ?? (await context.waitForEvent("page"));
    await page.waitForLoadState("domcontentloaded");

    return {
        page,
        async close(): Promise<void> {
            await browser?.close().catch(() => undefined);
            await stopChild(child);
        },
    };
}
