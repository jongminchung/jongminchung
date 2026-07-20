import { readFile } from "node:fs/promises";
import { protocol } from "electron";
import { appAssetContentType, resolveAppAsset } from "./protocol-path";

const APP_SCHEME = "app";

export function registerPrivilegedScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

export async function registerAppProtocol(rendererRoot: string): Promise<void> {
  protocol.handle(APP_SCHEME, async (request): Promise<Response> => {
    const resolution = resolveAppAsset(rendererRoot, request.url);
    if (resolution.kind === "notFound") return new Response("Not found", { status: 404 });
    if (resolution.kind === "forbidden") return new Response("Forbidden", { status: 403 });
    try {
      const contents = await readFile(resolution.path);
      return new Response(new Uint8Array(contents), {
        headers: {
          "Content-Type": appAssetContentType(resolution.path),
        },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return new Response("Not found", { status: 404 });
      }
      throw error;
    }
  });
}
