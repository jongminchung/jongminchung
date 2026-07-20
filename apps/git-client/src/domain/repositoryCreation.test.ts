import { describe, expect, it } from "vitest";
import {
  applyRepositoryCreationEvent,
  requestRepositoryCreationCancellation,
  startRepositoryCreation,
} from "./repositoryCreation";

const REQUEST_ID = "f77bceee-5296-4076-a8f1-c91e2020b294";

describe("repository creation state", () => {
  it("tracks started, progress, and completed clone events without exposing the command", () => {
    let state = startRepositoryCreation("clone");
    state = applyRepositoryCreationEvent(state, {
      kind: "started",
      requestId: REQUEST_ID,
      operation: "clone",
      displayCommand: "git clone https://secret@example.invalid/repository.git",
      startedAtMs: 1,
    });
    expect(state).toMatchObject({
      kind: "running",
      requestId: REQUEST_ID,
      phase: "Cloning repository…",
    });
    expect(JSON.stringify(state)).not.toContain("secret");

    state = applyRepositoryCreationEvent(state, {
      kind: "progress",
      requestId: REQUEST_ID,
      operation: "clone",
      sequence: 0,
      phase: "Receiving objects",
      percent: 42,
      current: 42,
      total: 100,
    });
    expect(state).toMatchObject({
      phase: "Receiving objects",
      percent: 42,
    });

    state = applyRepositoryCreationEvent(state, {
      kind: "completed",
      requestId: REQUEST_ID,
      operation: "clone",
      repository: {
        id: "02fc7f7c-3f66-514b-9470-451a776cfcc7",
        name: "repository",
        path: "/tmp/repository",
        gitDirectory: "/tmp/repository/.git",
        commonDirectory: "/tmp/repository/.git",
        isBare: false,
        gitVersion: {
          major: 2,
          minor: 51,
          patch: 0,
          display: "git version 2.51.0",
        },
      },
      exitCode: 0,
      durationMs: 12,
    });
    expect(state).toEqual({
      kind: "completed",
      operation: "clone",
      message: "Repository cloned.",
    });
  });

  it("ignores uncorrelated events and preserves cancellation until the terminal event", () => {
    let state = startRepositoryCreation("initialize");
    state = applyRepositoryCreationEvent(state, {
      kind: "started",
      requestId: REQUEST_ID,
      operation: "initialize",
      displayCommand: "git init",
      startedAtMs: 1,
    });
    const correlated = state;
    state = applyRepositoryCreationEvent(state, {
      kind: "failed",
      requestId: "129b10cd-d627-4748-940f-ba0ffd04279f",
      operation: "initialize",
      code: "spawnFailed",
      message: "wrong request",
      exitCode: null,
      durationMs: 1,
    });
    expect(state).toBe(correlated);

    state = requestRepositoryCreationCancellation(state);
    expect(state).toMatchObject({
      kind: "running",
      cancellation: "requested",
    });
    state = applyRepositoryCreationEvent(state, {
      kind: "cancelled",
      requestId: REQUEST_ID,
      operation: "initialize",
      reason: "requested",
      durationMs: 4,
    });
    expect(state).toEqual({
      kind: "cancelled",
      operation: "initialize",
      message: "Repository creation was cancelled.",
    });
  });
});
