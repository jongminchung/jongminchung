import { SafeModeViolationError } from "../../src/shared/contracts/repository-access";
import type { SettingsStore } from "./settings-store";

const SAFE_REPOSITORY_PATHS_SETTING = "safeRepositoryPaths";
const ACTIVE_REPOSITORY_PATH_SETTING = "activeRepositoryPath";

export type ExecutableCapability =
  | "gitMutation"
  | "terminal"
  | "hosting"
  | "externalExecution";

export function safeRepositoryPaths(
  settings: SettingsStore,
): ReadonlySet<string> {
  const value = settings.get(SAFE_REPOSITORY_PATHS_SETTING);
  if (value === null || value === undefined) return new Set();
  if (!Array.isArray(value)) {
    throw new Error("Safe Mode repository access state is invalid.");
  }
  const paths = value.filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
  if (paths.length !== value.length) {
    throw new Error("Safe Mode repository access state is invalid.");
  }
  return new Set(paths);
}

function activeRepositoryPath(settings: SettingsStore): string | null {
  const value = settings.get(ACTIVE_REPOSITORY_PATH_SETTING);
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Safe Mode active repository state is invalid.");
  }
  return value;
}

export function createRepositoryCapabilityAssertions({
  settings,
  repositoryPaths,
  repositoryAccessModes,
}: {
  readonly settings: SettingsStore;
  readonly repositoryPaths: ReadonlyMap<string, string>;
  readonly repositoryAccessModes: ReadonlyMap<string, "trusted" | "safe">;
}) {
  const assertRepositoryCapability = (
    repositoryId: string,
    capability: ExecutableCapability,
  ): void => {
    const path = repositoryPaths.get(repositoryId);
    if (path === undefined) {
      throw new Error(
        capability === "terminal"
          ? "Repository is not open for terminal access"
          : "Repository is not open for executable access.",
      );
    }
    if (
      repositoryAccessModes.get(repositoryId) === "safe" ||
      safeRepositoryPaths(settings).has(path)
    ) {
      throw new SafeModeViolationError(capability);
    }
  };
  const assertActiveCapability = (capability: ExecutableCapability): void => {
    const path = activeRepositoryPath(settings);
    if (path !== null && safeRepositoryPaths(settings).has(path)) {
      throw new SafeModeViolationError(capability);
    }
  };

  return {
    assertRepositoryCapability,
    assertActiveCapability,
  };
}
