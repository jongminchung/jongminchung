import type { DesktopTrpcDomain } from "../../src/shared/contracts/desktop-trpc";
import {
  GitExecutionRequestSchema,
  type GitRepositoryServiceRequest,
  GitRepositoryServiceRequestSchema,
  GitWorkingTreeFileRequestSchema,
  GitWriteWorkingTreeFileRequestSchema,
  type RepositoryId,
} from "../../src/shared/contracts/git-utility";
import { LocalHistoryRepositoryRequestSchema } from "../../src/shared/contracts/local-history-ipc";
import { TerminalCreateRequestSchema } from "../../src/shared/contracts/terminal";

function repositoryServiceExecutableIds(
  request: GitRepositoryServiceRequest,
): readonly RepositoryId[] {
  switch (request.operation) {
    case "compareBranches":
    case "listGitConfig":
    case "listSubmodules":
    case "listMergedBranches":
    case "loadCommitSignature":
    case "listRemotes":
    case "listWorktrees":
    case "readIgnoreRules":
    case "pushPreview":
    case "historyRewritePreview":
    case "createPatchText":
    case "listShelves":
    case "listChangelists":
    case "listRecoveryEntries":
    case "listLocalHistoryActivities":
    case "readLocalHistoryActivity":
    case "readLocalHistoryDiff":
    case "createLocalHistoryPatch":
    case "listConflicts":
    case "readConflict":
    case "loadSubmoduleDiff":
    case "resolveWorkingTreeFile":
      return [];
    case "executeSynchronizedBranchOperation":
      return request.repositoryIds;
    case "applyMultiRootRollback":
      return request.steps.map((step) => step.repositoryId);
    default:
      if ("repositoryId" in request) return [request.repositoryId];
      throw new Error("Repository service is unavailable in Safe Mode.");
  }
}

export function desktopTrpcRepositoryCapabilityIds(
  domain: DesktopTrpcDomain,
  procedure: string,
  input: unknown,
): readonly RepositoryId[] {
  if (domain === "terminal" && procedure === "create") {
    return [TerminalCreateRequestSchema.parse(input).repositoryId];
  }
  if (domain === "localHistory" && procedure === "repositoryService") {
    return repositoryServiceExecutableIds(
      LocalHistoryRepositoryRequestSchema.parse(input),
    );
  }
  if (domain !== "git") {
    throw new Error(
      `Desktop tRPC procedure ${domain}.${procedure} has invalid authorization`,
    );
  }
  switch (procedure) {
    case "repositoryService":
      return repositoryServiceExecutableIds(
        GitRepositoryServiceRequestSchema.parse(input),
      );
    case "query": {
      const request = GitExecutionRequestSchema.parse(input);
      return request.kind === "operation" ? [request.repositoryId] : [];
    }
    case "writeWorkingTreeFile":
      return [GitWriteWorkingTreeFileRequestSchema.parse(input).repositoryId];
    case "openWorkingTreeFile":
      return [GitWorkingTreeFileRequestSchema.parse(input).repositoryId];
    default:
      throw new Error(
        `Desktop tRPC procedure ${domain}.${procedure} has invalid authorization`,
      );
  }
}
