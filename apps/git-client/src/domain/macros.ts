export const SAVED_MACROS_KEY = "savedMacros";

export interface SavedMacro {
  readonly id: string;
  readonly name: string;
  readonly commandIds: readonly string[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSavedMacros(value: unknown): readonly SavedMacro[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((candidate): readonly SavedMacro[] => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      !Array.isArray(candidate.commandIds)
    )
      return [];
    const commandIds = candidate.commandIds
      .filter(
        (commandId): commandId is string =>
          typeof commandId === "string" &&
          /^[a-z]+(?:[A-Z][a-z]+|\.[a-z][A-Za-z]+)+$/u.test(commandId),
      )
      .slice(0, 1_000);
    return [
      {
        id: candidate.id.slice(0, 128),
        name: candidate.name.slice(0, 128),
        commandIds,
      },
    ];
  });
}
