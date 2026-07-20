import { describe, expect, it } from "vitest";
import { homeRelativePath, parseRecentProjects, updateRecentProjects } from "./recentProjects";

describe("recent projects", () => {
  it("migrates legacy paths and rejects duplicates", () => {
    expect(parseRecentProjects(["/tmp/one", "/tmp/one", "/tmp/two"])).toEqual([
      { path: "/tmp/one", name: "one", branch: null, lastOpenedAt: 3 },
      { path: "/tmp/two", name: "two", branch: null, lastOpenedAt: 1 },
    ]);
  });

  it("moves the latest metadata to the front", () => {
    expect(
      updateRecentProjects(
        [
          {
            path: "/tmp/one",
            name: "one",
            branch: null,
            lastOpenedAt: 1,
          },
        ],
        {
          path: "/tmp/two",
          name: "two",
          branch: "main",
          lastOpenedAt: 2,
        },
      ).map((entry) => entry.path),
    ).toEqual(["/tmp/two", "/tmp/one"]);
  });

  it("shortens paths below the user home", () => {
    expect(homeRelativePath("/Users/test/work/repo", "/Users/test")).toBe("~/work/repo");
  });
});
