import { describe, expect, it } from "vitest";
import { collectTransitiveWorkspaceDependencies } from "./nx-changelog-renderer.mjs";

describe("dependency-aware Nx changelog renderer", () => {
  it("collects transitive workspace dependencies without external packages", () => {
    const graph = {
      dependencies: {
        app: [
          { source: "app", target: "shared", type: "static" },
          { source: "app", target: "npm:react", type: "static" },
        ],
        base: [],
        shared: [{ source: "shared", target: "base", type: "static" }],
      },
      externalNodes: {
        "npm:react": { data: {}, name: "npm:react", type: "npm" },
      },
      nodes: {
        app: { data: { root: "apps/app" }, name: "app", type: "app" },
        base: { data: { root: "packages/base" }, name: "base", type: "lib" },
        shared: { data: { root: "packages/shared" }, name: "shared", type: "lib" },
      },
    };

    expect(collectTransitiveWorkspaceDependencies(graph, "app")).toEqual(
      new Set(["app", "shared", "base"]),
    );
  });
});
