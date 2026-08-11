import { dirname, extname, isAbsolute, relative, resolve } from "node:path";

interface PlantUmlPathContext {
  readonly contentRoot: string;
  readonly extensions: ReadonlySet<string>;
  readonly markdownPath: string | null;
}

export function isLocalPlantUmlUrl(
  url: string | undefined,
  context: PlantUmlPathContext,
): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.startsWith("#") || url.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/iu.test(url)) return false;
  return context.extensions.has(extname(decodeUrlPath(url).toLowerCase()));
}

export function resolvePlantUmlSourcePath(
  url: string,
  context: Pick<PlantUmlPathContext, "contentRoot" | "markdownPath">,
): string {
  const urlPath = decodeUrlPath(url);
  const basePath = context.markdownPath ? dirname(context.markdownPath) : context.contentRoot;
  const resolvedPath = urlPath.startsWith("/")
    ? resolve(context.contentRoot, `.${urlPath}`)
    : resolve(basePath, urlPath);

  if (!isInsideRoot(resolvedPath, context.contentRoot)) {
    throw new Error(`PlantUML link must stay inside docs content root: ${url}`);
  }
  return resolvedPath;
}

function decodeUrlPath(url: string): string {
  const path = url.split(/[?#]/u, 1)[0] ?? "";
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function isInsideRoot(path: string, root: string): boolean {
  const rootRelativePath = relative(root, path);
  return (
    rootRelativePath === "" || (!rootRelativePath.startsWith("..") && !isAbsolute(rootRelativePath))
  );
}
