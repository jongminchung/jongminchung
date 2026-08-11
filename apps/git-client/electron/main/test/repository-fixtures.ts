import type { RepositoryId, RepositoryRecord } from "../../../src/shared/contracts/git-utility";
import type { RepositorySnapshot } from "../../../src/shared/contracts/model";

export const TEST_REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7" as RepositoryId;

export const TEST_REPOSITORY: RepositoryRecord = Object.freeze({
  id: TEST_REPOSITORY_ID,
  name: "repository",
  path: "/tmp/repository",
  gitDirectory: "/tmp/repository/.git",
  commonDirectory: "/tmp/repository/.git",
  isBare: false,
  gitVersion: Object.freeze({
    major: 2,
    minor: 55,
    patch: 0,
    display: "git version 2.55.0",
  }),
});

export const TEST_SNAPSHOT: RepositorySnapshot = Object.freeze({
  ...TEST_REPOSITORY,
  currentBranch: "main",
  headOid: "0123456789abcdef0123456789abcdef01234567",
  upstream: "origin/main",
  remoteUrl: "https://example.invalid/repository.git",
  ahead: 2,
  behind: 1,
  isShallow: false,
  isDetached: false,
  hasCommits: true,
  operation: null,
});
