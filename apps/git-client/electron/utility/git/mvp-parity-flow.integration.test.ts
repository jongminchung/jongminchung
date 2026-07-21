import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureCanonicalGitFixtureState,
  createCanonicalGitFixture,
} from "../../../scripts/parity/mvp-fixture.mjs";
import type { GitRequestId } from "../../../src/shared/contracts/git-utility";
import type { GitOperation } from "../../../src/shared/contracts/model";
import { GitUtility } from "./git-utility";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Rebased MVP canonical Git flow", () => {
  it("stages, commits, amends, creates a branch, and pushes to the local remote", async () => {
    const parent = await mkdtemp(join(tmpdir(), "rebased-parity-core-flow-"));
    temporaryDirectories.push(parent);
    const fixture = createCanonicalGitFixture({ parentDirectory: parent, state: "dirty" });
    const utility = new GitUtility();
    const repository = await utility.openRepository({ path: fixture.repositoryPath });
    vi.stubEnv("GIT_AUTHOR_DATE", "2025-01-15T12:03:00.000Z");
    vi.stubEnv("GIT_COMMITTER_DATE", "2025-01-15T12:03:00.000Z");

    const execute = async (operation: GitOperation): Promise<void> => {
      const terminal = await utility.executeQuery(
        {
          kind: "operation",
          operation,
          repositoryId: repository.id,
          requestId: randomUUID() as GitRequestId,
        },
        () => undefined,
      );
      expect(terminal.kind, operation.kind).toBe("completed");
    };

    await execute({ kind: "stage", paths: ["src/app.ts", "notes.txt"] });
    await execute({
      kind: "commit",
      message: "feat: complete parity flow",
      amend: false,
      signOff: false,
      gpgSign: false,
    });
    await execute({
      kind: "commit",
      message: "feat: complete parity flow (amended)",
      amend: true,
      signOff: false,
      gpgSign: false,
    });
    await execute({
      kind: "createBranch",
      name: "parity/mvp",
      startPoint: "HEAD",
      checkout: true,
    });
    await execute({
      kind: "push",
      destination: {
        remote: "origin",
        remoteRef: "refs/heads/parity/mvp",
        localRevision: "HEAD",
        setUpstream: true,
      },
      mode: { kind: "normal" },
    });

    expect(captureCanonicalGitFixtureState(fixture)).toMatchObject({
      branch: "parity/mvp",
      changedPaths: [],
      commitSubjects: [
        "feat: complete parity flow (amended)",
        "feat: add deterministic parity fixture",
      ],
      remoteRefs: ["refs/heads/main", "refs/heads/parity/mvp"],
    });
  }, 30_000);
});
