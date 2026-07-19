import type { HistoryRewritePreview, RebasePlanEntry } from "../generated";

export function prepareHistoryPlan(
  preview: HistoryRewritePreview,
  squashOids: ReadonlySet<string>,
): readonly RebasePlanEntry[] {
  if (squashOids.size < 2) return preview.entries;
  const selected = preview.entries.filter((entry) => squashOids.has(entry.oid));
  const oldest = selected[0];
  return preview.entries.map((entry) => {
    if (!squashOids.has(entry.oid) || entry.mergeCommit) return entry;
    if (entry.oid === oldest?.oid) {
      return { ...entry, action: "reword", message: oldest.subject };
    }
    return { ...entry, action: "squash" };
  });
}

export function historyPlanError(entries: readonly RebasePlanEntry[]): string | null {
  let hasTarget = false;
  for (const entry of entries) {
    if (entry.mergeCommit && entry.action !== "pick") return "Merge commits must remain pick entries.";
    if ((entry.action === "squash" || entry.action === "fixup") && !hasTarget) {
      return "Squash and fixup require an earlier picked commit.";
    }
    if (entry.action === "reword" && !entry.message?.trim()) {
      return `Enter a commit message for ${entry.oid.slice(0, 8)}.`;
    }
    if (entry.action !== "drop") hasTarget = true;
  }
  return hasTarget ? null : "At least one commit must remain in the branch.";
}

export function moveHistoryPlanEntry(
  entries: readonly RebasePlanEntry[],
  sourceOid: string,
  targetOid: string,
): readonly RebasePlanEntry[] {
  const sourceIndex = entries.findIndex((entry) => entry.oid === sourceOid);
  const targetIndex = entries.findIndex((entry) => entry.oid === targetOid);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return entries;
  const next = [...entries];
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) return entries;
  next.splice(targetIndex, 0, moved);
  return next;
}
