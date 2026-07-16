import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";
import { branchUrl, commitUrl, resolveForge } from "./forge";
import {
  assembleHunkPatch,
  assembleSelectedLinePatch,
  parseCommitFiles,
  parseBlame,
  parseDiffDocument,
  parseDiffHunks,
  parseLog,
  parseFileHistory,
  parseNameStatus,
  parseRefs,
  parseStashList,
  parseStatusV2,
  parseTree,
  placeGraphLanes,
} from "./parsers";

describe("porcelain parsers", () => {
  it("parses NUL-delimited status including paths with spaces and renames", () => {
    const status = parseStatusV2(
      "# branch.oid abc123\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -1\n# stash 3\n1 M. N... 100644 100644 100644 a b src/a file.ts\0" +
        "2 R. N... 100644 100644 100644 a b R100 src/new name.ts\0src/old name.ts\0? 한글 파일.md\0",
    );
    expect(status).toMatchObject({
      branch: "main",
      upstream: "origin/main",
      ahead: 2,
      behind: 1,
      stashCount: 3,
    });
    expect(status.changes).toEqual([
      expect.objectContaining({ path: "src/a file.ts", status: "modified", staged: true }),
      expect.objectContaining({
        path: "src/new name.ts",
        oldPath: "src/old name.ts",
        status: "renamed",
      }),
      expect.objectContaining({ path: "한글 파일.md", status: "untracked" }),
    ]);
  });

  it("parses refs and record-delimited logs", () => {
    const refs = parseRefs(
      "refs/heads/main\0abc\0commit\0*\0refs/remotes/origin/main\0>\0subject\0Jamie\0" +
        "1700000000\0\n",
    );
    expect(refs[0]).toMatchObject({ shortName: "main", kind: "local", current: true });
    const commits = parseLog(
      "\x1eabc\0parent\0Jamie\0j@example.com\0" +
        "1700000000\0" +
        "1700000010\0HEAD -> refs/heads/main\0feat: parser\0body\0",
    );
    expect(commits[0]).toMatchObject({ oid: "abc", parents: ["parent"], subject: "feat: parser" });
  });

  it("parses commit numstat records including binary files and renames", () => {
    const header = [
      "oid",
      "parent",
      "Jamie",
      "j@example.com",
      "1",
      "Jamie",
      "j@example.com",
      "2",
      "",
      "message",
    ].join("\0");
    const numstat = [
      "12\t3\tsrc/a.ts",
      "-\t-\tassets/logo.png",
      "0\t0\t",
      "old name.ts",
      "new name.ts",
      "",
    ].join("\0");
    const files = parseCommitFiles(`${header}\0\0\n${numstat}`);
    expect(files).toEqual([
      expect.objectContaining({ path: "src/a.ts", additions: 12, deletions: 3, binary: false }),
      expect.objectContaining({ path: "assets/logo.png", binary: true }),
      expect.objectContaining({
        path: "new name.ts",
        oldPath: "old name.ts",
        status: "renamed",
      }),
    ]);
  });

  it("parses native stash metadata and NUL-delimited changed files", () => {
    const stashes = parseStashList(
      `\x1e${["stash@{0}", "abc123", "On main: work in progress", "Jamie", "j@example.com", "1700000000", ""].join("\0")}` +
        `\x1e${["stash@{1}", "def456", "On feat: 한글 메시지", "Min", "m@example.com", "1700000100", ""].join("\0")}`,
    );
    expect(stashes).toEqual([
      expect.objectContaining({
        selector: "stash@{0}",
        oid: "abc123",
        subject: "On main: work in progress",
        createdAt: 1_700_000_000,
      }),
      expect.objectContaining({ selector: "stash@{1}", subject: "On feat: 한글 메시지" }),
    ]);
    expect(parseNameStatus("M\0src/a file.ts\0R100\0old.ts\0new.ts\0")).toEqual([
      expect.objectContaining({ path: "src/a file.ts", status: "modified" }),
      expect.objectContaining({ path: "new.ts", oldPath: "old.ts", status: "renamed" }),
    ]);
  });
});

describe("graph and patch helpers", () => {
  it("allocates a second lane for a merge parent", () => {
    const commits = [
      {
        oid: "c",
        parents: ["b", "x"],
        author: "A",
        email: "",
        authoredAt: 0,
        committedAt: 0,
        refs: [],
        subject: "merge",
        body: "",
      },
      {
        oid: "b",
        parents: ["a"],
        author: "A",
        email: "",
        authoredAt: 0,
        committedAt: 0,
        refs: [],
        subject: "main",
        body: "",
      },
      {
        oid: "x",
        parents: ["a"],
        author: "A",
        email: "",
        authoredAt: 0,
        committedAt: 0,
        refs: [],
        subject: "side",
        body: "",
      },
    ];
    expect(placeGraphLanes(commits)[0]).toMatchObject({ lane: 0, parentLanes: [1] });
  });

  it("assembles selected hunks without dropping line prefixes", () => {
    const hunks = parseDiffHunks("@@ -1 +1 @@\n-old\n+new\n@@ -8 +8 @@\n-a\n+b");
    expect(assembleHunkPatch("diff --git a/a b/a\n--- a/a\n+++ b/a", [hunks[1]!])).toContain(
      "@@ -8 +8 @@\n-a\n+b",
    );
  });

  it("assembles zero-context line hunks with recalculated ranges", () => {
    const patch = [
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,3 +1,4 @@",
      " one",
      "-two",
      "+TWO",
      "+extra",
      " three",
    ].join("\n");
    const document = parseDiffDocument(patch);
    const selected = assembleSelectedLinePatch(
      document.fileHeader,
      document.hunks[0]!,
      new Set([1, 3]),
    );
    expect(selected).toContain("@@ -2,1 +1,0 @@\n-two");
    expect(selected).toContain("@@ -2,0 +3,1 @@\n+extra");
    expect(selected).not.toContain("+TWO");
  });
});

describe("repository inspection parsers", () => {
  it("parses tree, file history, and line porcelain blame", () => {
    expect(parseTree("100644 blob abc 12\tsrc/a file.ts\0")).toEqual([
      { mode: "100644", kind: "blob", oid: "abc", size: 12, path: "src/a file.ts" },
    ]);
    expect(
      parseFileHistory(
        "\x1eabc\0parent\0Jamie\0j@example.com\0" + "1700000000\0main\0change file\0",
      ),
    ).toEqual([expect.objectContaining({ oid: "abc", subject: "change file" })]);
    const oid = "a".repeat(40);
    expect(
      parseBlame(
        `${oid} 1 3 1\nauthor Jamie\nauthor-mail <j@example.com>\nauthor-time 1700000000\nsummary initial\n\tconst value = 1;\n`,
      ),
    ).toEqual([
      expect.objectContaining({
        oid,
        finalLine: 3,
        author: "Jamie",
        content: "const value = 1;",
      }),
    ]);
  });
});

describe("forge URLs and cursors", () => {
  it("normalizes SSH and HTTPS remotes", () => {
    expect(resolveForge("git@github.com:acme/repo.git")).toEqual({
      forge: "github",
      webBaseUrl: "https://github.com/acme/repo",
    });
    expect(commitUrl("https://gitlab.example.com/acme/repo.git", "abc")).toBe(
      "https://gitlab.example.com/acme/repo/-/commit/abc",
    );
    expect(branchUrl("git@github.com:acme/repo.git", "feat/a")).toBe(
      "https://github.com/acme/repo/tree/feat%2Fa",
    );
  });

  it("round-trips filter cursors and rejects junk", () => {
    const cursor = { skip: 500, query: "한글", branch: "main", order: "topology" as const };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor("not-json")).toBeUndefined();
  });
});
