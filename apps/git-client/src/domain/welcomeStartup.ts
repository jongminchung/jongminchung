import { parseRecentProjects, updateRecentProjects, type RecentProject } from "./recentProjects";

type WorkspaceSettingKey =
  | "activeRepositoryPath"
  | "openRepositoryPaths"
  | "recentProjects"
  | "recentRepositories";

export interface WorkspaceStartupState {
  readonly activeRepositoryPath: string | null;
  readonly openRepositoryPaths: readonly string[];
  readonly recentProjects: readonly RecentProject[];
}

export function recentProjectsWithRestoreFailures(
  recentProjects: readonly RecentProject[],
  failedPaths: readonly string[],
  restoredAt = Date.now(),
): readonly RecentProject[] {
  return failedPaths.reduce(
    (projects, path, index) =>
      updateRecentProjects(projects, {
        path,
        name: path.split("/").filter(Boolean).at(-1) ?? path,
        branch: projects.find((project) => project.path === path)?.branch ?? null,
        lastOpenedAt: restoredAt - index,
      }),
    recentProjects,
  );
}

function parseStoredPaths(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (path): path is string =>
          typeof path === "string" && path.length > 0 && path.length <= 32_768,
      ),
    ),
  ];
}

export async function loadWorkspaceStartupState(
  readSetting: (key: WorkspaceSettingKey) => Promise<unknown>,
): Promise<WorkspaceStartupState> {
  const [storedPaths, storedActivePath, storedProjects, legacyRepositories] = await Promise.all([
    readSetting("openRepositoryPaths"),
    readSetting("activeRepositoryPath"),
    readSetting("recentProjects"),
    readSetting("recentRepositories"),
  ]);
  const recentProjects = parseRecentProjects(storedProjects);

  return {
    activeRepositoryPath:
      typeof storedActivePath === "string" && storedActivePath.length > 0 ? storedActivePath : null,
    openRepositoryPaths: parseStoredPaths(storedPaths),
    recentProjects:
      recentProjects.length > 0 ? recentProjects : parseRecentProjects(legacyRepositories),
  };
}
