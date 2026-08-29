import {
  docsAreaSchema,
  isLocale,
  type DocsArea,
  type Locale,
} from "../content-model.ts";

const DOCUMENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function segmentsFrom(relativePath: string): string[] {
  return relativePath.replaceAll("\\", "/").split("/");
}

function localizedPath(
  relativePath: string,
  expectedDepth: readonly number[],
): Readonly<{ locale: Locale; segments: readonly string[] }> {
  const segments = segmentsFrom(relativePath);
  const [locale, ...rest] = segments;
  if (locale === undefined || !isLocale(locale))
    throw new Error(`${relativePath}: unsupported content locale.`);
  if (!expectedDepth.includes(segments.length))
    throw new Error(`${relativePath}: unsupported content path depth.`);
  return Object.freeze({ locale, segments: Object.freeze(rest) });
}

function mdxSlug(filename: string, relativePath: string): string {
  if (!filename.endsWith(".mdx"))
    throw new Error(`${relativePath}: content file must use .mdx.`);
  const slug = filename.slice(0, -".mdx".length);
  if (!DOCUMENT_ID_PATTERN.test(slug))
    throw new Error(`${relativePath}: content filename must be a slug.`);
  return slug;
}

/** Blog 파일 경로를 canonical locale·ID로 정규화함 */
export function parseBlogContentPath(
  relativePath: string,
): Readonly<{ locale: Locale; id: string }> {
  const { locale, segments } = localizedPath(relativePath, [2]);
  const filename = segments[0];
  if (filename === undefined)
    throw new Error(`${relativePath}: Blog filename is required.`);
  const id = mdxSlug(filename, relativePath);
  if (id === "index")
    throw new Error(`${relativePath}: Blog index files are not supported.`);
  return Object.freeze({ locale, id });
}

/** Docs 파일 경로와 명시적 landing 역할을 canonical identity로 정규화함 */
export function parseDocsContentPath(
  relativePath: string,
  overview = false,
): Readonly<{ locale: Locale; id: string; area?: DocsArea }> {
  const { locale, segments } = localizedPath(relativePath, [2, 3]);
  if (segments.length === 1) {
    const filename = segments[0];
    if (filename !== "index.mdx")
      throw new Error(`${relativePath}: Docs root must use index.mdx.`);
    if (overview)
      throw new Error(`${relativePath}: root overview is derived from path.`);
    return Object.freeze({ locale, id: "docs-overview" });
  }

  const [areaValue, filename] = segments;
  const areaResult = docsAreaSchema.safeParse(areaValue);
  if (!areaResult.success)
    throw new Error(`${relativePath}: unsupported Docs area.`);
  if (filename === undefined)
    throw new Error(`${relativePath}: Docs filename is required.`);
  const area = areaResult.data;
  const slug = mdxSlug(filename, relativePath);
  if (slug === "index") {
    if (overview)
      throw new Error(`${relativePath}: area overview is derived from path.`);
    return Object.freeze({ locale, area, id: `${area}-overview` });
  }
  return Object.freeze({
    locale,
    area,
    id: overview ? `${slug}-overview` : slug,
  });
}
