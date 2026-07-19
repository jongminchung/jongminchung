export function codeLanguage(className: string | undefined): string {
  return className?.replace("language-", "") ?? "text";
}

export function isExcalidrawCodeLanguage(language: string): boolean {
  return language.toLowerCase() === "excalidraw";
}

export type MdxCodeBlock =
  | Readonly<{ kind: "code"; language: string; source: string }>
  | Readonly<{ kind: "excalidraw"; source: string }>;

export function classifyMdxCodeBlock(
  className: string | undefined,
  children: unknown,
): MdxCodeBlock {
  const source = typeof children === "string" ? children.trimEnd() : "";
  const language = codeLanguage(className);
  return isExcalidrawCodeLanguage(language)
    ? Object.freeze({ kind: "excalidraw", source })
    : Object.freeze({ kind: "code", language, source });
}
