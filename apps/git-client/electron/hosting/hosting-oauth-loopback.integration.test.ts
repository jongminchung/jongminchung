import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { NodeHostingOAuthLoopbackFactory } from "./hosting-oauth-loopback";

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Loopback address is unavailable");
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return address.port;
}

describe("Hosting OAuth loopback callback", () => {
  it("[성공] exact host, path, state의 GitLab authorization code만 수락함", async () => {
    const port = await availablePort();
    const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
    const session = await new NodeHostingOAuthLoopbackFactory().open(
      redirectUri,
      "expected-state",
    );
    const controller = new AbortController();
    const waiting = session.wait(controller.signal);

    const response = await fetch(
      `${redirectUri}?code=authorization-code&state=expected-state`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(waiting).resolves.toEqual({
      code: "authorization-code",
    });
    await session.close();
  });

  it("[실패] state mismatch를 code로 처리하지 않음", async () => {
    const port = await availablePort();
    const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
    const session = await new NodeHostingOAuthLoopbackFactory().open(
      redirectUri,
      "expected-state",
    );
    const waiting = session.wait(new AbortController().signal);

    const response = await fetch(
      `${redirectUri}?code=authorization-code&state=forged-state`,
    );

    expect(response.status).toBe(400);
    await expect(waiting).resolves.toEqual({
      error: "callback_validation_failed",
    });
    await session.close();
  });
});
