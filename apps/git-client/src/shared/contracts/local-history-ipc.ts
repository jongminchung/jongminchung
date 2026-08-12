import { z } from "zod";
import type {
    GitLocalHistoryActivitiesPage,
    GitLocalHistoryActivity,
    GitLocalHistoryActivityDetail,
    GitLocalHistoryScope,
    GitRepositoryServiceRequest,
    RepositoryId,
} from "./git-utility";
import { GitRepositoryServiceRequestSchema } from "./git-utility";

export type LocalHistoryRepositoryRequest = Extract<
    GitRepositoryServiceRequest,
    {
        readonly operation:
            | "listLocalHistoryActivities"
            | "readLocalHistoryActivity"
            | "readLocalHistoryDiff"
            | "revertLocalHistory"
            | "createLocalHistoryPatch"
            | "putLocalHistoryLabel";
    }
>;

export const LocalHistoryRepositoryRequestSchema =
    GitRepositoryServiceRequestSchema.transform(
        (request, context): LocalHistoryRepositoryRequest => {
            switch (request.operation) {
                case "listLocalHistoryActivities":
                case "readLocalHistoryActivity":
                case "readLocalHistoryDiff":
                case "revertLocalHistory":
                case "createLocalHistoryPatch":
                case "putLocalHistoryLabel":
                    return request;
                default:
                    context.addIssue({
                        code: "custom",
                        message: `Repository operation is unavailable to Local History: ${request.operation}`,
                        input: request,
                    });
                    return z.NEVER;
            }
        },
    );

export function parseLocalHistoryRepositoryRequest(
    raw: unknown,
): LocalHistoryRepositoryRequest {
    return LocalHistoryRepositoryRequestSchema.parse(raw);
}

export function localHistoryRequestRepositoryId(
    request: LocalHistoryRepositoryRequest,
): RepositoryId {
    return request.operation === "listLocalHistoryActivities"
        ? request.scope.repositoryId
        : request.repositoryId;
}

export interface LocalHistoryApi {
    listActivities(
        scope: GitLocalHistoryScope,
        cursor: string | null,
        limit: number,
        query: string,
        showSystemEvents: boolean,
    ): Promise<GitLocalHistoryActivitiesPage>;
    readActivity(
        repositoryId: RepositoryId,
        activityId: string,
    ): Promise<GitLocalHistoryActivityDetail>;
    readDiff(
        repositoryId: RepositoryId,
        activityId: string,
        path: string,
    ): Promise<string>;
    revert(
        repositoryId: RepositoryId,
        activityId: string,
        paths: readonly string[],
        includeLater: boolean,
    ): Promise<void>;
    createPatch(
        repositoryId: RepositoryId,
        activityId: string,
        paths: readonly string[],
    ): Promise<string>;
    putLabel(
        repositoryId: RepositoryId,
        label: string,
    ): Promise<GitLocalHistoryActivity>;
}
