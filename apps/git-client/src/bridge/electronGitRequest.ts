import {
    GitExecutionRequestSchema,
    type GitExecutionRequest,
} from "../shared/contracts/git-request";
import type { GitRequestId } from "../shared/contracts/git-utility";
import type { GitRequest } from "../shared/contracts/model/index";

export function translateGitRequest(
    request: GitRequest,
    requestId: GitRequestId,
): GitExecutionRequest {
    return GitExecutionRequestSchema.parse({ ...request, requestId });
}
