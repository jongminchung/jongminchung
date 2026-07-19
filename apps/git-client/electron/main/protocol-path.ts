import { extname, relative, resolve, sep } from "node:path";

export type AppAssetResolution =
  | Readonly<{ kind: "asset"; path: string }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "notFound" }>;

export function resolveAppAsset(rendererRoot: string, requestUrl: string): AppAssetResolution {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return { kind: "notFound" };
  }
  if (url.protocol !== "app:" || url.host !== "git-client") return { kind: "notFound" };
  if (/(?:\/)(?:%2e|\.){2}(?=\/|[?#]|$)/iu.test(requestUrl)) return { kind: "forbidden" };

  let requestedPath: string;
  try {
    requestedPath = decodeURIComponent(url.pathname);
  } catch {
    return { kind: "notFound" };
  }

  const candidate = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const candidatePath = resolve(rendererRoot, candidate);
  if (!isPathInside(rendererRoot, candidatePath)) return { kind: "forbidden" };
  return {
    kind: "asset",
    path: extname(candidatePath) === "" ? resolve(rendererRoot, "index.html") : candidatePath,
  };
}

export function isPathInside(root: string, candidate: string): boolean {
  const offset = relative(resolve(root), resolve(candidate));
  return offset !== ".." && !offset.startsWith(`..${sep}`) && !offset.startsWith(sep);
}

const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
});

export function appAssetContentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
