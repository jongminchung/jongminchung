// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createAuditFixture } from "./create-fixture.ts";
import { runGit } from "./git-process.ts";
import { captureGitState, compareGitStates } from "./git-state-oracle.ts";

const testRoots: any[] = [];

async function createFixture() {
  const parent = await mkdtemp(join(tmpdir(), "rebased-111-oracle-test-"));
  testRoots.push(parent);
  return createAuditFixture(join(parent, "fixture"));
}

after(async () => {
  for (const root of testRoots)
    await rm(root, { recursive: true, force: true });
});

void describe("independent Rebased 1.1.11 Git fixture and state oracle", () => {
  void it("creates equivalent repositories with deterministic Git state", async () => {
    const fixture = await createFixture();
    const [rebased, gitClient] = await Promise.all([
      captureGitState(fixture.rebasedPath),
      captureGitState(fixture.gitClientPath),
    ]);

    assert.deepEqual(compareGitStates(rebased, gitClient), {
      equal: true,
      differences: [],
    });
    assert.equal(rebased.head.ref, "refs/heads/main");
    assert.match(rebased.porcelainV2, /1 MM N\.\.\. 100644 100644 100644/u);
    assert.match(rebased.porcelainV2, /\? notes\.txt/u);
    assert.match(rebased.cachedDiff, /export const staged = true;/u);
    assert.match(rebased.workingDiff, /export const working = true;/u);
    assert.equal(rebased.stash.length, 1);
    assert.equal(rebased.stash[0].subject, "On main: audit-baseline");
    assert.ok(rebased.refs.some((ref: any) => ref.name === "refs/stash"));
    assert.ok(rebased.refs.some((ref: any) => ref.name === "refs/tags/v1.0.0"));
    assert.ok(
      rebased.remoteRefs[0].refs.some(
        (ref: any) => ref.name === "refs/heads/feature/topic",
      ),
    );
    assert.deepEqual(
      rebased.refs.map((ref: any) => ref.name),
      rebased.refs
        .map((ref: any) => ref.name)
        .toSorted((left: any, right: any) =>
          left < right ? -1 : left > right ? 1 : 0,
        ),
    );
  });

  void it("produces the same object IDs in separately generated fixture roots", async () => {
    const [first, second] = await Promise.all([
      createFixture(),
      createFixture(),
    ]);
    const [firstState, secondState] = await Promise.all([
      captureGitState(first.rebasedPath),
      captureGitState(second.rebasedPath),
    ]);

    assert.deepEqual(compareGitStates(firstState, secondState), {
      equal: true,
      differences: [],
    });
  });

  void it("reports the sections changed by a real Git mutation", async () => {
    const fixture = await createFixture();
    const before = await captureGitState(fixture.gitClientPath);
    await runGit(fixture.gitClientPath, ["add", "notes.txt"]);
    const after = await captureGitState(fixture.gitClientPath);

    assert.deepEqual(compareGitStates(before, after), {
      equal: false,
      differences: ["porcelainV2", "cachedDiff"],
    });
  });

  void it("rejects relative paths and non-empty fixture roots", async () => {
    await assert.rejects(
      captureGitState("relative/repository"),
      /must be absolute/u,
    );
    const fixture = await createFixture();
    await assert.rejects(createAuditFixture(fixture.root), /must be empty/u);
  });
});
