/** `codeLanguage` 공개 기능을 제공함 */
export function codeLanguage(className: string | undefined): string {
  return /(?:^|\s)language-([^\s]+)/u.exec(className ?? "")?.[1] ?? "text";
}

/** `isExcalidrawCodeLanguage` 조건을 판별함 */
export function isExcalidrawCodeLanguage(language: string): boolean {
  return language.toLowerCase() === "excalidraw";
}

export type MdxCodeBlock =
  | Readonly<{ kind: "code"; language: string; source: string }>
  | Readonly<{ kind: "excalidraw"; source: string }>;

function codeText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(codeText).join("");
  if (typeof value !== "object" || value === null) return "";
  if (!("props" in value)) return "";
  const props = value.props;
  if (typeof props !== "object" || props === null || !("children" in props))
    return "";
  return codeText(props.children);
}

/** `classifyMdxCodeBlock` 공개 기능을 제공함 */
export function classifyMdxCodeBlock(
  className: string | undefined,
  children: unknown,
): MdxCodeBlock {
  const source = codeText(children).trimEnd();
  const language = codeLanguage(className);
  return isExcalidrawCodeLanguage(language)
    ? Object.freeze({ kind: "excalidraw", source })
    : Object.freeze({ kind: "code", language, source });
}
