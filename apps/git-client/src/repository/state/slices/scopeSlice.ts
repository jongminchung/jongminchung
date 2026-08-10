import type {
  RepositoryScopeSlice,
  RepositoryWorkspaceSliceCreator,
  RepositoryWorkspaceStoreOptions,
} from "../repositoryWorkspaceStoreTypes";

let nextWorkspaceGeneration = 1;

export function createRepositoryScopeSlice(
  options: RepositoryWorkspaceStoreOptions,
): RepositoryWorkspaceSliceCreator<RepositoryScopeSlice> {
  const generation = nextWorkspaceGeneration++;
  let active = true;
  const createRequestToken = () => ({ repositoryId: options.repositoryId, generation });
  const isRequestCurrent = (token: ReturnType<typeof createRequestToken>) =>
    active && token.repositoryId === options.repositoryId && token.generation === generation;

  return () => ({
    repositoryId: options.repositoryId,
    generation,
    createRequestToken,
    isRequestCurrent,
    runRepositoryTask: async (task, commit, reject) => {
      const token = createRequestToken();
      try {
        const value = await task();
        if (!isRequestCurrent(token)) return false;
        commit(value);
        return true;
      } catch (error) {
        if (!isRequestCurrent(token)) return false;
        if (reject === undefined) throw error;
        reject(error);
        return true;
      }
    },
    invalidateScope: () => {
      active = false;
    },
  });
}
