import type { ConsoleChunk } from "./types";

export function orderedConsoleChunks(chunks: readonly ConsoleChunk[]): readonly ConsoleChunk[] {
  return [...chunks].sort((left, right) => left.sequence - right.sequence);
}
