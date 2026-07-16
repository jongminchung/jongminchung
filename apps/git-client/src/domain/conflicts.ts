export interface ConflictBlock {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly local: string;
  readonly remote: string;
}

export function parseConflictBlocks(result: string): readonly ConflictBlock[] {
  const lines = result.split("\n");
  const blocks: ConflictBlock[] = [];
  let start = -1;
  let separator = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("<<<<<<< ")) {
      start = index;
      separator = -1;
    } else if (start >= 0 && line === "=======") {
      separator = index;
    } else if (start >= 0 && separator >= 0 && line.startsWith(">>>>>>> ")) {
      blocks.push({
        index: blocks.length,
        start,
        end: index,
        local: lines.slice(start + 1, separator).join("\n"),
        remote: lines.slice(separator + 1, index).join("\n"),
      });
      start = -1;
      separator = -1;
    }
  }
  return blocks;
}

export function resolveConflictBlock(
  result: string,
  block: ConflictBlock,
  choice: "local" | "remote" | "both",
): string {
  const lines = result.split("\n");
  const replacement =
    choice === "local"
      ? block.local
      : choice === "remote"
        ? block.remote
        : [block.local, block.remote].filter(Boolean).join("\n");
  lines.splice(block.start, block.end - block.start + 1, ...replacement.split("\n"));
  return lines.join("\n");
}
