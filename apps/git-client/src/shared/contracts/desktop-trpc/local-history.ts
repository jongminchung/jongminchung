import type { mutation } from "../desktop-trpc";
import { GitRepositoryServiceResultSchema } from "../git-utility";
import { LocalHistoryRepositoryRequestSchema } from "../local-history-ipc";

/** Local History has a deliberately narrow repository-mutation surface. */
export function createLocalHistoryProcedures(createMutation: typeof mutation) {
  return {
    repositoryService: createMutation(
      "localHistory",
      "repositoryService",
      LocalHistoryRepositoryRequestSchema,
      GitRepositoryServiceResultSchema,
      { kind: "repositoryCapability", capability: "gitMutation" },
    ),
  } as const;
}
