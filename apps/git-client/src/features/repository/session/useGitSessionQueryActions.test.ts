import { describe, expect, it, vi } from "vitest";
import type { GitBridge } from "../../../application/git-session/ports/GitBridge";
import type { GitSessionQueryPort } from "../../../application/git-session/ports/GitSessionBackend";
import { createGitSessionRuntime } from "../../../application/git-session/state/GitSessionRuntime";
import type {
  GitRequest,
  RepositorySnapshot,
} from "../../../shared/contracts/model/index";
import { runProjectTextSearch } from "./useGitSessionQueryActions";

describe("프로젝트 관련 검색 세션", () => {
  it("[실패] 지우거나 사냥할 때 라이브 쿼리를 시작하지 않고 취소합니다. 빈 쿼리를 보내", async () => {
    const runtime = createGitSessionRuntime("repository-1");
    runtime.activeSearchRequest = "request-1";
    const cancel = vi.fn(async () => undefined);
    const search = vi.fn(async () => []);
    const runRequest = vi.fn(async (_request: GitRequest) => "");

    await expect(
      runProjectTextSearch(
        "",
        { matchCase: false, words: false, regex: false },
        {
          activeSnapshot: () => ({ id: "repository-1" }) as RepositorySnapshot,
          gitBridge: { cancel } as unknown as GitBridge,
          queryPort: { search } as unknown as GitSessionQueryPort,
          runRequest,
          runtime,
        },
      ),
    ).resolves.toEqual([]);

    expect(cancel).toHaveBeenCalledWith("request-1");
    expect(runtime.activeSearchRequest).toBeNull();
    expect(search).not.toHaveBeenCalled();
    expect(runRequest).not.toHaveBeenCalled();
  });
});
