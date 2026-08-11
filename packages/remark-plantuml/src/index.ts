import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { encodePlantUmlSource, normalizePlantUmlServerBaseUrl } from "./encoding.js";
import { isLocalPlantUmlUrl, resolvePlantUmlSourcePath } from "./path.js";

export { createPlantUmlSvgUrl, encodePlantUmlSource } from "./encoding.js";

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

export function remarkPlantUml(options: RemarkPlantUmlOptions): RemarkPlantUmlTransformer {
  const contentRoot = resolve(options.contentRoot ?? process.cwd());
  const serverBaseUrl = normalizePlantUmlServerBaseUrl(options.serverBaseUrl);
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
    const sourcePath = resolvePlantUmlSourcePath(node.url, context);
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

function createPlantUmlSvgUrlFromContext(source: string, context: TransformContext): string {
  return `${context.serverBaseUrl}/${encodePlantUmlSource(source)}`;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
