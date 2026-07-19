import { describe, expect, it } from "vitest";
import { buildDiffArguments } from "./diff-query";

describe("buildDiffArguments", () => {
  it("matches the existing native diff options and protects paths with an option terminator", () => {
    expect(
      buildDiffArguments({
        from: "HEAD~1",
        to: "HEAD",
        paths: ["src/한글 file.ts"],
        staged: false,
        options: { whitespace: "ignoreAll", contextLines: 10 },
      }),
    ).toEqual([
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--find-renames",
      "--find-copies",
      "--patch",
      "--ignore-all-space",
      "--unified=10",
      "HEAD~1",
      "HEAD",
      "--",
      "src/한글 file.ts",
    ]);
  });

  it("supports staged full-context diffs", () => {
    expect(
      buildDiffArguments({
        from: null,
        to: null,
        paths: [],
        staged: true,
        options: { whitespace: "show", contextLines: null },
      }),
    ).toEqual([
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--find-renames",
      "--find-copies",
      "--patch",
      "--unified=50000",
      "--cached",
    ]);
  });

  it.each([
    {
      label: "invalid context",
      query: {
        from: null,
        to: null,
        paths: [],
        staged: false,
        options: { whitespace: "show" as const, contextLines: 4 },
      },
    },
    {
      label: "option-like revision",
      query: {
        from: "--output=/tmp/leak",
        to: null,
        paths: [],
        staged: false,
        options: { whitespace: "show" as const, contextLines: 3 },
      },
    },
    {
      label: "repository escape",
      query: {
        from: null,
        to: null,
        paths: ["../secret"],
        staged: false,
        options: { whitespace: "show" as const, contextLines: 3 },
      },
    },
  ])("rejects $label", ({ query }) => {
    expect(() => buildDiffArguments(query)).toThrow();
  });
});
