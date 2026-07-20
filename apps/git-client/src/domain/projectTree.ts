import type { FileChange, TreeEntry } from "./types";

export interface ProjectTreeEntry {
  readonly path: string;
  readonly name: string;
  readonly kind: TreeEntry["kind"];
  readonly oid: string;
  readonly size?: number;
  readonly status?: FileChange["status"];
}

function childName(parentPath: string, path: string): string | null {
  const prefix = parentPath ? `${parentPath}/` : "";
  if (!path.startsWith(prefix)) return null;
  const relative = path.slice(prefix.length);
  const [name] = relative.split("/");
  return name || null;
}

/**
 * Combines the committed tree with working-tree-only paths. Git remains the
 * source of truth; synthetic directories only make untracked paths reachable.
 */
export function mergeProjectTreeEntries(
  parentPath: string,
  tracked: readonly TreeEntry[],
  changes: readonly FileChange[],
): readonly ProjectTreeEntry[] {
  const entries = new Map<string, ProjectTreeEntry>();

  for (const entry of tracked) {
    const name = entry.path.includes("/") ? entry.path.split("/").at(-1)! : entry.path;
    const path = parentPath ? `${parentPath}/${name}` : name;
    entries.set(name, {
      path,
      name,
      kind: entry.kind,
      oid: entry.oid,
      size: entry.size,
      status: changes.find((change) => change.path === path)?.status,
    });
  }

  for (const change of changes) {
    const name = childName(parentPath, change.path);
    if (!name) continue;
    const path = parentPath ? `${parentPath}/${name}` : name;
    const existing = entries.get(name);
    if (existing) {
      if (existing.path === change.path && existing.status !== change.status) {
        entries.set(name, { ...existing, status: change.status });
      }
      continue;
    }
    const directory = change.path !== path;
    entries.set(name, {
      path,
      name,
      kind: directory ? "tree" : "blob",
      oid: `working-tree:${path}`,
      status: directory ? undefined : change.status,
    });
  }

  return [...entries.values()].sort((left, right) => {
    const leftDirectory = left.kind === "tree";
    const rightDirectory = right.kind === "tree";
    if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}
