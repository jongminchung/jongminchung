export interface ProjectResourceCloser {
  unwatchRepository(repositoryId: string): Promise<unknown>;
  closeRepositoryTerminals(repositoryId: string): Promise<unknown>;
  forgetRepository(repositoryId: string): void;
}

export async function closeProjectResources(
  repositoryIds: readonly string[],
  closer: ProjectResourceCloser,
): Promise<void> {
  const uniqueRepositoryIds = [...new Set(repositoryIds)];
  await Promise.allSettled(
    uniqueRepositoryIds.flatMap((repositoryId) => [
      closer.unwatchRepository(repositoryId),
      closer.closeRepositoryTerminals(repositoryId),
    ]),
  );
  for (const repositoryId of uniqueRepositoryIds) {
    closer.forgetRepository(repositoryId);
  }
}
