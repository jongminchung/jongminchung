export const SCRATCH_FILES_KEY = "scratchFiles";

export interface ScratchLanguage {
  readonly id: string;
  readonly label: string;
  readonly extension: string;
}

export interface ScratchFile {
  readonly id: string;
  readonly name: string;
  readonly languageId: string;
  readonly content: string;
  readonly updatedAtMs: number;
}

export const SCRATCH_LANGUAGES: readonly ScratchLanguage[] = [
  { id: "text", label: "Plain Text", extension: "txt" },
  { id: "typescript", label: "TypeScript", extension: "ts" },
  { id: "javascript", label: "JavaScript", extension: "js" },
  { id: "json", label: "JSON", extension: "json" },
  { id: "markdown", label: "Markdown", extension: "md" },
  { id: "shell", label: "Shell Script", extension: "sh" },
  { id: "html", label: "HTML", extension: "html" },
  { id: "css", label: "CSS", extension: "css" },
  { id: "xml", label: "XML", extension: "xml" },
  { id: "yaml", label: "YAML", extension: "yaml" },
];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseScratchFiles(value: unknown): readonly ScratchFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): readonly ScratchFile[] => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.languageId !== "string" ||
      typeof candidate.content !== "string"
    )
      return [];
    return [
      {
        id: candidate.id.slice(0, 128),
        name: candidate.name.slice(0, 256),
        languageId: candidate.languageId.slice(0, 64),
        content: candidate.content.slice(0, 5_242_880),
        updatedAtMs:
          typeof candidate.updatedAtMs === "number" && Number.isFinite(candidate.updatedAtMs)
            ? candidate.updatedAtMs
            : 0,
      },
    ];
  });
}

export function nextScratchName(files: readonly ScratchFile[], language: ScratchLanguage): string {
  const names = new Set(files.map((file) => file.name));
  for (let index = 1; index < 10_000; index += 1) {
    const name = `scratch_${index}.${language.extension}`;
    if (!names.has(name)) return name;
  }
  return `scratch_${crypto.randomUUID()}.${language.extension}`;
}
