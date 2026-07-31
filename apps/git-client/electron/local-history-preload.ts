import { contextBridge, ipcRenderer } from "electron";
import {
  GitRepositoryServiceResultSchema,
  type GitRepositoryServiceResult,
} from "../src/shared/contracts/git-utility";
import { IPC_CHANNELS } from "../src/shared/contracts/ipc";
import type { LocalHistoryApi } from "../src/shared/contracts/local-history-ipc";
import {
  parseLocalHistoryRepositoryRequest,
  type LocalHistoryRepositoryRequest,
} from "../src/shared/contracts/local-history-ipc";

async function invoke(request: LocalHistoryRepositoryRequest): Promise<GitRepositoryServiceResult> {
  const validatedRequest = parseLocalHistoryRepositoryRequest(request);
  const raw: unknown = await ipcRenderer.invoke(
    IPC_CHANNELS.localHistoryRepositoryService,
    validatedRequest,
  );
  const result = GitRepositoryServiceResultSchema.parse(raw);
  if (result.operation !== validatedRequest.operation) {
    throw new Error("Local History result did not match its request");
  }
  return result;
}

const api: LocalHistoryApi = {
  async listActivities(scope, cursor, limit, query, showSystemEvents) {
    const result = await invoke({
      operation: "listLocalHistoryActivities",
      scope,
      cursor,
      limit,
      query,
      showSystemEvents,
    });
    if (result.operation !== "listLocalHistoryActivities") {
      throw new Error("Unexpected Local History result");
    }
    return result.value;
  },
  async readActivity(repositoryId, activityId) {
    const result = await invoke({
      operation: "readLocalHistoryActivity",
      repositoryId,
      activityId,
    });
    if (result.operation !== "readLocalHistoryActivity") {
      throw new Error("Unexpected Local History result");
    }
    return result.value;
  },
  async readDiff(repositoryId, activityId, path) {
    const result = await invoke({
      operation: "readLocalHistoryDiff",
      repositoryId,
      activityId,
      path,
    });
    if (result.operation !== "readLocalHistoryDiff") {
      throw new Error("Unexpected Local History result");
    }
    return result.value;
  },
  async revert(repositoryId, activityId, paths, includeLater) {
    const result = await invoke({
      operation: "revertLocalHistory",
      repositoryId,
      activityId,
      paths,
      includeLater,
    });
    if (result.operation !== "revertLocalHistory") {
      throw new Error("Unexpected Local History result");
    }
  },
  async createPatch(repositoryId, activityId, paths) {
    const result = await invoke({
      operation: "createLocalHistoryPatch",
      repositoryId,
      activityId,
      paths,
    });
    if (result.operation !== "createLocalHistoryPatch") {
      throw new Error("Unexpected Local History result");
    }
    return result.value;
  },
  async putLabel(repositoryId, label) {
    const result = await invoke({
      operation: "putLocalHistoryLabel",
      repositoryId,
      label,
    });
    if (result.operation !== "putLocalHistoryLabel") {
      throw new Error("Unexpected Local History result");
    }
    return result.value;
  },
};

contextBridge.exposeInMainWorld("gitClientLocalHistory", api);
