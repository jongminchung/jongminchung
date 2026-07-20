export type FileContent =
  | { kind: "text"; path: string; content: string; sizeBytes: number; lineCount: number }
  | { kind: "binary"; path: string; sizeBytes: number }
  | { kind: "invalidUtf8"; path: string; sizeBytes: number }
  | { kind: "tooLarge"; path: string; sizeBytes: number; lineCount: number | null }
  | { kind: "missing"; path: string };
