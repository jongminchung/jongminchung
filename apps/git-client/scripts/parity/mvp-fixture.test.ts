import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleCommits } from "../../src/domain/sampleData";
import { createCanonicalGitFixture, loadMvpFixtureContract } from "./mvp-fixture.mjs";

describe("Rebased 1.1.8 MVP fixture contract", () => {
  it("provides one deterministic contract for every parallel implementation lane", () => {
    const contract = loadMvpFixtureContract();

    expect(contract.referenceVersion).toBe("1.1.8");
    expect(contract.clock.iso).toBe("2025-01-15T12:00:00.000Z");
    expect(contract.gitIdentity).toEqual({
      name: "Rebased Parity",
      email: "rebased-parity@example.invalid",
    });
    expect(
      contract.slices.map(({ id, lane, repositoryState }) => ({ id, lane, repositoryState })),
    ).toEqual([
      { id: "shell.welcome", lane: "welcome", repositoryState: null },
      { id: "shell.project-log", lane: "log", repositoryState: "clean" },
      { id: "changes.commit-tool-window", lane: "changes", repositoryState: "dirty" },
      { id: "platform.terminal", lane: "terminal", repositoryState: "clean" },
    ]);
  });

  it("materializes identical Git state in isolated worker directories", async () => {
    const firstParent = await mkdtemp(join(tmpdir(), "rebased-parity-worker-a-"));
    const secondParent = await mkdtemp(join(tmpdir(), "rebased-parity-worker-b-"));
    try {
      const first = createCanonicalGitFixture({ parentDirectory: firstParent, state: "dirty" });
      const second = createCanonicalGitFixture({ parentDirectory: secondParent, state: "dirty" });

      expect(first.normalized).toEqual(second.normalized);
      expect(first.normalized).toMatchObject({
        branch: "main",
        commitSubjects: ["feat: add deterministic parity fixture", "chore: initialize fixture"],
        changedPaths: [" M src/app.ts", "?? notes.txt"],
        remoteRefs: ["refs/heads/main"],
      });
      expect(first.repositoryPath).not.toBe(second.repositoryPath);
      expect(first.remotePath).not.toBe(second.remotePath);
    } finally {
      await Promise.all([
        rm(firstParent, { recursive: true, force: true }),
        rm(secondParent, { recursive: true, force: true }),
      ]);
    }
  });

  it("uses the canonical fixture clock in the renderer mock", () => {
    expect(sampleCommits[0]?.authoredAt).toBe(1_736_942_400);
    expect(sampleCommits[1]?.authoredAt).toBe(1_736_937_700);
  });

  it("materializes the canonical staged state", async () => {
    const parent = await mkdtemp(join(tmpdir(), "rebased-parity-staged-"));
    try {
      const fixture = createCanonicalGitFixture({ parentDirectory: parent, state: "staged" });
      expect(fixture.normalized.changedPaths).toEqual(["A  notes.txt", "M  src/app.ts"]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("materializes the canonical conflict state", async () => {
    const parent = await mkdtemp(join(tmpdir(), "rebased-parity-conflict-"));
    try {
      const fixture = createCanonicalGitFixture({ parentDirectory: parent, state: "conflict" });
      expect(fixture.normalized).toMatchObject({
        branch: "main",
        changedPaths: ["UU src/app.ts"],
      });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
