import { readFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";

export const publicPlantUmlSvgServerBaseUrl = "https://www.plantuml.com/plantuml/svg";

export interface RemarkPlantUmlOptions {
  readonly className?: string;
  readonly contentRoot?: string;
  readonly extensions?: readonly string[];
  readonly languages?: readonly string[];
  readonly serverBaseUrl: string;
}

interface TransformContext {
  readonly className: string;
  readonly contentRoot: string;
  readonly extensions: ReadonlySet<string>;
  readonly languages: ReadonlySet<string>;
  readonly markdownPath: string | null;
  readonly serverBaseUrl: string;
}

interface MarkdownFile {
  readonly path?: string;
}

interface MarkdownNode {
  alt?: string;
  children?: MarkdownNode[];
  lang?: string;
  title?: string;
  type?: string;
  url?: string;
  value?: string;
}

interface HtmlNode {
  readonly type: "html";
  readonly value: string;
}

export type RemarkPlantUmlTransformer = (tree: unknown, file: MarkdownFile) => Promise<void>;

export default function remarkPlantUml(options: RemarkPlantUmlOptions): RemarkPlantUmlTransformer {
  const contentRoot = resolve(options.contentRoot ?? process.cwd());
  const serverBaseUrl = createServerBaseUrl(options.serverBaseUrl);
  const className = options.className ?? "plantuml-diagram";
  const languages = createNormalizedSet(options.languages ?? ["plantuml", "puml"]);
  const extensions = createExtensionSet(options.extensions ?? [".puml", ".plantuml"]);

  return async function transform(tree: unknown, file: MarkdownFile): Promise<void> {
    await transformNode(tree, {
      className,
      contentRoot,
      extensions,
      languages,
      markdownPath: resolveMarkdownPath(file),
      serverBaseUrl,
    });
  };
}

async function transformNode(node: unknown, context: TransformContext): Promise<HtmlNode | null> {
  if (!isNode(node)) return null;

  if (node.type === "code" && isPlantUmlLanguage(node.lang, context.languages)) {
    return createHtmlNode(
      createPlantUmlSvgUrlFromContext(node.value ?? "", context),
      null,
      context.className,
    );
  }

  if ((node.type === "link" || node.type === "image") && isLocalPlantUmlUrl(node.url, context)) {
    const sourcePath = resolvePlantUmlPath(node.url, context);
    const source = await readFile(sourcePath, "utf8");
    return createHtmlNode(
      createPlantUmlSvgUrlFromContext(source, context),
      node.title ?? extractCaption(node),
      context.className,
    );
  }

  if (!Array.isArray(node.children)) return null;

  const replacements = await Promise.all(
    node.children.map((child) => transformNode(child, context)),
  );
  for (const [index, replacement] of replacements.entries()) {
    if (replacement) node.children[index] = replacement;
  }

  return null;
}

function resolveMarkdownPath(file: MarkdownFile): string | null {
  if (typeof file.path === "string" && file.path.length > 0) return resolve(file.path);
  return null;
}

function isNode(value: unknown): value is MarkdownNode {
  return typeof value === "object" && value !== null;
}

function isPlantUmlLanguage(language: string | undefined, languages: ReadonlySet<string>): boolean {
  return typeof language === "string" && languages.has(language.toLowerCase());
}

function isLocalPlantUmlUrl(url: string | undefined, context: TransformContext): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.startsWith("#") || url.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;

  return isPlantUmlPath(decodeUrlPath(url), context.extensions);
}

function isPlantUmlPath(path: string, extensions: ReadonlySet<string>): boolean {
  return extensions.has(extname(path.toLowerCase()));
}

function decodeUrlPath(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? "";
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function resolvePlantUmlPath(url: string, context: TransformContext): string {
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

function isInsideRoot(path: string, root: string): boolean {
  const rootRelativePath = relative(root, path);
  return (
    rootRelativePath === "" || (!rootRelativePath.startsWith("..") && !isAbsolute(rootRelativePath))
  );
}

export function createPlantUmlSvgUrl(source: string, serverBaseUrl: string): string {
  return `${createServerBaseUrl(serverBaseUrl)}/${encodePlantUmlSource(source)}`;
}

function createPlantUmlSvgUrlFromContext(source: string, context: TransformContext): string {
  return `${context.serverBaseUrl}/${encodePlantUmlSource(source)}`;
}

export function encodePlantUmlSource(source: string): string {
  return encodePlantUmlBytes(deflateRawSync(Buffer.from(source, "utf8")));
}

function encodePlantUmlBytes(bytes: Buffer): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const chunk = append3Bytes(first, second, third);

    if (index + 1 >= bytes.length) {
      encoded += chunk.slice(0, 2);
    } else if (index + 2 >= bytes.length) {
      encoded += chunk.slice(0, 3);
    } else {
      encoded += chunk;
    }
  }
  return encoded;
}

function append3Bytes(first: number, second: number, third: number): string {
  const c1 = first >> 2;
  const c2 = ((first & 0x3) << 4) | (second >> 4);
  const c3 = ((second & 0xf) << 2) | (third >> 6);
  const c4 = third & 0x3f;
  return `${encode6Bit(c1)}${encode6Bit(c2)}${encode6Bit(c3)}${encode6Bit(c4)}`;
}

function encode6Bit(value: number): string {
  if (value < 10) return String.fromCharCode(48 + value);
  if (value < 36) return String.fromCharCode(65 + value - 10);
  if (value < 62) return String.fromCharCode(97 + value - 36);
  if (value === 62) return "-";
  if (value === 63) return "_";
  throw new Error(`Invalid PlantUML 6-bit value: ${value}`);
}

function createHtmlNode(src: string, caption: string | null, className: string): HtmlNode {
  const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "";
  const alt = caption ?? "PlantUML diagram";
  return {
    type: "html",
    value: `<figure class="${escapeHtml(className)}"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">${figcaption}</figure>`,
  };
}

function extractCaption(node: MarkdownNode): string | null {
  if (typeof node.alt === "string") return node.alt;
  if (!Array.isArray(node.children)) return null;

  const text = node.children
    .map((child) => extractText(child))
    .join("")
    .trim();
  return text.length > 0 ? text : null;
}

function extractText(node: unknown): string {
  if (!isNode(node)) return "";
  if (typeof node.value === "string") return node.value;
  if (!Array.isArray(node.children)) return "";
  return node.children.map((child) => extractText(child)).join("");
}

function createServerBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("PlantUML serverBaseUrl is required");
  }
  return trimTrailingSlash(trimmed);
}

function createNormalizedSet(values: readonly string[]): ReadonlySet<string> {
  return new Set(values.map((value) => value.toLowerCase()));
}

function createExtensionSet(values: readonly string[]): ReadonlySet<string> {
  return new Set(
    values.map((value) => {
      const extension = value.startsWith(".") ? value : `.${value}`;
      return extension.toLowerCase();
    }),
  );
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
