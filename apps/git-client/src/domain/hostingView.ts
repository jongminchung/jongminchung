import type { HostingChangeRequest } from "../shared/contracts/model";

export type HostingListScope = "all" | "open" | "closed" | "draft";

export function filterHostingChangeRequests(
  items: readonly HostingChangeRequest[],
  query: string,
  scope: HostingListScope,
): readonly HostingChangeRequest[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesScope = scope === "all" || (scope === "draft" ? item.draft : item.state === scope);
    if (!matchesScope) return false;
    if (normalizedQuery.length === 0) return true;
    return [
      String(item.number),
      item.title,
      item.author,
      item.sourceBranch,
      item.targetBranch,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function adjacentHostingChangeRequest(
  items: readonly HostingChangeRequest[],
  selectedNumber: number | null,
  direction: "first" | "last" | "next" | "previous",
): HostingChangeRequest | null {
  if (items.length === 0) return null;
  if (direction === "first") return items[0] ?? null;
  if (direction === "last") return items.at(-1) ?? null;

  const selectedIndex = items.findIndex((item) => item.number === selectedNumber);
  const origin = selectedIndex < 0 ? (direction === "next" ? -1 : 0) : selectedIndex;
  const offset = direction === "next" ? 1 : -1;
  const nextIndex = Math.max(0, Math.min(items.length - 1, origin + offset));
  return items[nextIndex] ?? null;
}
