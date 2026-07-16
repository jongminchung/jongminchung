export interface LogCursor {
  readonly skip: number;
  readonly query: string;
  readonly branch?: string;
  readonly order: "date" | "topology" | "firstParent";
}

export function encodeCursor(cursor: LogCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function decodeCursor(value: string): LogCursor | undefined {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!parsed || typeof parsed !== "object") return undefined;
    const cursor = parsed as Partial<LogCursor>;
    if (typeof cursor.skip !== "number" || typeof cursor.query !== "string") return undefined;
    if (!cursor.order || !["date", "topology", "firstParent"].includes(cursor.order))
      return undefined;
    return cursor as LogCursor;
  } catch {
    return undefined;
  }
}
