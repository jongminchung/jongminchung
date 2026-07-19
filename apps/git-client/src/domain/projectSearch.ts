export type ProjectSearchMode = "text" | "class" | "symbol";

export interface ProjectTextMatch {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly content: string;
}

export interface ProjectSearchResult extends ProjectTextMatch {
  readonly kind: ProjectSearchMode;
  readonly name: string;
}

export interface ProjectSearchOptions {
  readonly matchCase: boolean;
  readonly words: boolean;
  readonly regex: boolean;
}

function escapedRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function replacementExpression(
  query: string,
  options: ProjectSearchOptions,
): RegExp {
  const source = options.regex ? query : escapedRegExp(query);
  const bounded = options.words ? `\\b(?:${source})\\b` : source;
  return new RegExp(bounded, options.matchCase ? "gu" : "giu");
}

export function replaceProjectText(
  content: string,
  query: string,
  replacement: string,
  options: ProjectSearchOptions,
): string {
  const expression = replacementExpression(query, options);
  return options.regex
    ? content.replace(expression, replacement)
    : content.replace(expression, () => replacement);
}

const RESULT_LIMIT = 500;
const IDENTIFIER = "[A-Za-z_$][A-Za-z0-9_$]*";

const CLASS_DECLARATIONS = [
  new RegExp(`\\b(?:class|interface|enum|struct|trait|record|object|protocol|actor|namespace|module)\\s+(${IDENTIFIER})`, "u"),
  new RegExp(`\\btype(?:alias)?\\s+(${IDENTIFIER})(?:\\s|=|<)`, "u"),
] as const;

const SYMBOL_DECLARATIONS = [
  ...CLASS_DECLARATIONS,
  new RegExp(`\\b(?:async\\s+)?(?:function|func|fn|def)\\s*(?:\\([^)]*\\)\\s*)?(${IDENTIFIER})`, "u"),
  new RegExp(`\\b(?:const|let|var|val)\\s+(${IDENTIFIER})`, "u"),
  new RegExp(`^\\s*(?:export\\s+)?(?:default\\s+)?(${IDENTIFIER})\\s*\\([^)]*\\)\\s*(?::[^={]+)?(?:=>|\\{)`, "u"),
  new RegExp(`^\\s*(?:(?:public|private|protected|internal|static|final|abstract|override|open|suspend|async)\\s+)*(?:${IDENTIFIER}(?:[<>,.?\\[\\]: ]+${IDENTIFIER})?)\\s+(${IDENTIFIER})\\s*\\(`, "u"),
] as const;

function resultFields(value: string): readonly [number, number, string] | null {
  const nulFields = value.split("\0");
  if (nulFields.length >= 3) {
    const line = Number(nulFields[0]?.replace(/^:/u, ""));
    const column = Number(nulFields[1]);
    if (Number.isSafeInteger(line) && Number.isSafeInteger(column)) {
      return [line, column, nulFields.slice(2).join("\0")];
    }
  }
  const separatedFields = value.match(/^:?(\d+)(?:\0|:)(\d+)(?:\0|:)(.*)$/u);
  if (!separatedFields) return null;
  return [
    Number(separatedFields[1]),
    Number(separatedFields[2]),
    separatedFields[3] ?? "",
  ];
}

export function parseProjectTextMatches(output: string): readonly ProjectTextMatch[] {
  const results: ProjectTextMatch[] = [];
  let cursor = 0;
  while (cursor < output.length && results.length < RESULT_LIMIT) {
    const pathEnd = output.indexOf("\0", cursor);
    if (pathEnd < 0) break;
    const recordEnd = output.indexOf("\n", pathEnd + 1);
    const end = recordEnd < 0 ? output.length : recordEnd;
    const path = output.slice(cursor, pathEnd);
    const fields = resultFields(output.slice(pathEnd + 1, end));
    if (path.length > 0 && fields !== null) {
      const [line, column, content] = fields;
      if (line > 0 && column > 0) results.push({ path, line, column, content });
    }
    cursor = end + 1;
  }
  return results;
}

function declaration(
  content: string,
  expressions: readonly RegExp[],
): Readonly<{ name: string; column: number }> | null {
  for (const expression of expressions) {
    const match = expression.exec(content);
    const name = match?.[1];
    if (!match || !name) continue;
    const nameOffset = match[0].lastIndexOf(name);
    return {
      name,
      column: match.index + Math.max(0, nameOffset) + 1,
    };
  }
  return null;
}

function nameMatches(name: string, query: string, matchCase: boolean): boolean {
  const candidate = matchCase ? name : name.toLocaleLowerCase();
  const expected = matchCase ? query : query.toLocaleLowerCase();
  return candidate.includes(expected);
}

export function projectSearchResults(
  matches: readonly ProjectTextMatch[],
  mode: ProjectSearchMode,
  query: string,
  matchCase: boolean,
): readonly ProjectSearchResult[] {
  if (mode === "text") {
    return matches.slice(0, RESULT_LIMIT).map((match) => ({
      ...match,
      kind: "text",
      name: `${match.path}:${match.line}`,
    }));
  }
  const expressions = mode === "class" ? CLASS_DECLARATIONS : SYMBOL_DECLARATIONS;
  return matches.flatMap((match): readonly ProjectSearchResult[] => {
    const symbol = declaration(match.content, expressions);
    if (!symbol || !nameMatches(symbol.name, query, matchCase)) return [];
    return [{
      ...match,
      kind: mode,
      name: symbol.name,
      column: symbol.column,
    }];
  }).slice(0, RESULT_LIMIT);
}
