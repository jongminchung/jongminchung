import { describe, expect, it, vi } from "vitest";
import { loadWorkspaceStartupState, recentProjectsWithRestoreFailures } from "./welcomeStartup";

describe("workspace startup", () => {
  it("loads ordered open repositories and the active path", async () => {
    const settings = new Map<string, unknown>([
      ["openRepositoryPaths", ["/work/one", "/work/two", "/work/one", 3]],
      ["activeRepositoryPath", "/work/two"],
      ["safeRepositoryPaths", ["/work/one"]],
      ["recentRepositories", ["/work/recent"]],
    ]);
    const readSetting = vi.fn(async (key: string): Promise<unknown> => settings.get(key));

    await expect(loadWorkspaceStartupState(readSetting)).resolves.toEqual({
      activeRepositoryPath: "/work/two",
      openRepositoryPaths: ["/work/one", "/work/two"],
      safeRepositoryPaths: ["/work/one"],
      recentProjects: [
        {
          path: "/work/recent",
          name: "recent",
          branch: null,
          lastOpenedAt: 1,
        },
      ],
    });
    expect(readSetting.mock.calls.map(([key]) => key)).toEqual([
      "openRepositoryPaths",
      "activeRepositoryPath",
      "safeRepositoryPaths",
      "recentProjects",
      "recentRepositories",
    ]);
  });

  it("prefers metadata-rich recent projects over the legacy list", async () => {
    const readSetting = async (key: string): Promise<unknown> => {
      if (key === "recentProjects") {
        return [
          {
            path: "/work/current",
            name: "Current",
            branch: "main",
            lastOpenedAt: 42,
          },
        ];
      }
      if (key === "recentRepositories") return ["/work/legacy"];
      return null;
    };

    const startup = await loadWorkspaceStartupState(readSetting);

    expect(startup.activeRepositoryPath).toBeNull();
    expect(startup.openRepositoryPaths).toEqual([]);
    expect(startup.safeRepositoryPaths).toEqual([]);
    expect(startup.recentProjects).toEqual([
      {
        path: "/work/current",
        name: "Current",
        branch: "main",
        lastOpenedAt: 42,
      },
    ]);
  });

  it("rejects malformed persisted paths at the storage boundary", async () => {
    const startup = await loadWorkspaceStartupState(async (key) => {
      if (key === "openRepositoryPaths") return ["", null, "/work/valid"];
      if (key === "activeRepositoryPath") return 42;
      return null;
    });

    expect(startup).toEqual({
      activeRepositoryPath: null,
      openRepositoryPaths: ["/work/valid"],
      safeRepositoryPaths: [],
      recentProjects: [],
    });
  });

  it("restores only validated safe-mode repository paths", async () => {
    const startup = await loadWorkspaceStartupState(async (key) => {
      if (key === "openRepositoryPaths") return ["/work/safe", "/work/trusted"];
      if (key === "safeRepositoryPaths") return ["/work/safe", "", 42, "/work/safe"];
      return null;
    });

    expect(startup.safeRepositoryPaths).toEqual(["/work/safe"]);
  });

  it("keeps failed restore paths available for retry or removal", () => {
    expect(
      recentProjectsWithRestoreFailures(
        [
          {
            path: "/work/existing",
            name: "Existing",
            branch: "main",
            lastOpenedAt: 10,
          },
        ],
        ["/missing/one", "/missing/two"],
        100,
      ),
    ).toEqual([
      {
        path: "/missing/one",
        name: "one",
        branch: null,
        lastOpenedAt: 100,
      },
      {
        path: "/missing/two",
        name: "two",
        branch: null,
        lastOpenedAt: 99,
      },
      {
        path: "/work/existing",
        name: "Existing",
        branch: "main",
        lastOpenedAt: 10,
      },
    ]);
  });
});
