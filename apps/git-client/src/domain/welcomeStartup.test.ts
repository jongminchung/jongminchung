import { describe, expect, it, vi } from "vitest";
import { loadWorkspaceStartupState, recentProjectsWithRestoreFailures } from "./welcomeStartup";

describe("workspace startup", () => {
  it("loads ordered open repositories and the active path", async () => {
    const settings = new Map<string, unknown>([
      ["openRepositoryPaths", ["/work/one", "/work/two", "/work/one", 3]],
      ["activeRepositoryPath", "/work/two"],
      ["recentRepositories", ["/work/recent"]],
    ]);
    const readSetting = vi.fn(async (key: string): Promise<unknown> => settings.get(key));

    await expect(loadWorkspaceStartupState(readSetting)).resolves.toEqual({
      activeRepositoryPath: "/work/two",
      openRepositoryPaths: ["/work/one", "/work/two"],
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
      recentProjects: [],
    });
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
