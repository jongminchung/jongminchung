export interface RecentProject {
  readonly path: string;
  readonly name: string;
  readonly branch: string | null;
  readonly lastOpenedAt: number;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectName(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

export function parseRecentProjects(value: unknown): readonly RecentProject[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .flatMap((entry, index): readonly RecentProject[] => {
      const path =
        typeof entry === "string"
          ? entry
          : isRecord(entry) && typeof entry.path === "string"
            ? entry.path
            : null;
      if (path === null || path.length === 0 || path.length > 32_768 || seen.has(path)) return [];
      seen.add(path);
      const name =
        isRecord(entry) && typeof entry.name === "string" && entry.name.length > 0
          ? entry.name.slice(0, 512)
          : projectName(path);
      const branch =
        isRecord(entry) && typeof entry.branch === "string" && entry.branch.length > 0
          ? entry.branch.slice(0, 1_024)
          : null;
      const lastOpenedAt =
        isRecord(entry) &&
        typeof entry.lastOpenedAt === "number" &&
        Number.isFinite(entry.lastOpenedAt)
          ? entry.lastOpenedAt
          : value.length - index;
      return [{ path, name, branch, lastOpenedAt }];
    })
    .slice(0, 12);
}

export function updateRecentProjects(
  projects: readonly RecentProject[],
  project: RecentProject,
): readonly RecentProject[] {
  return [project, ...projects.filter((entry) => entry.path !== project.path)]
    .toSorted((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, 12);
}

export function homeRelativePath(path: string, homePath: string | null): string {
  if (homePath === null || path === homePath) return path;
  return path.startsWith(`${homePath}/`) ? `~${path.slice(homePath.length)}` : path;
}
