import type { GitCreationEvent, GitCreationOperation } from "../shared/contracts/git-utility";

export type RepositoryCreationState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{
      kind: "running";
      operation: GitCreationOperation;
      requestId: string | null;
      phase: string;
      percent: number | null;
      cancellation: "available" | "requested";
    }>
  | Readonly<{
      kind: "completed";
      operation: GitCreationOperation;
      message: string;
    }>
  | Readonly<{
      kind: "failed";
      operation: GitCreationOperation;
      message: string;
    }>
  | Readonly<{
      kind: "cancelled";
      operation: GitCreationOperation;
      message: string;
    }>;

export const IDLE_REPOSITORY_CREATION = Object.freeze({
  kind: "idle",
} as const satisfies RepositoryCreationState);

export function startRepositoryCreation(operation: GitCreationOperation): RepositoryCreationState {
  return {
    kind: "running",
    operation,
    requestId: null,
    phase: operation === "clone" ? "Starting clone…" : "Initializing repository…",
    percent: null,
    cancellation: "available",
  };
}

export function requestRepositoryCreationCancellation(
  state: RepositoryCreationState,
): RepositoryCreationState {
  if (state.kind !== "running") return state;
  return { ...state, cancellation: "requested", phase: "Cancelling…" };
}

export function rejectRepositoryCreationCancellation(
  state: RepositoryCreationState,
): RepositoryCreationState {
  if (state.kind !== "running") return state;
  return {
    ...state,
    cancellation: "available",
    phase:
      state.operation === "clone" ? "Clone is still running." : "Initialization is still running.",
  };
}

export function failRepositoryCreation(
  state: RepositoryCreationState,
  message: string,
): RepositoryCreationState {
  if (state.kind !== "running") return state;
  return { kind: "failed", operation: state.operation, message };
}

export function completeRepositoryCreation(
  state: RepositoryCreationState,
): RepositoryCreationState {
  if (state.kind !== "running") return state;
  return {
    kind: "completed",
    operation: state.operation,
    message: state.operation === "clone" ? "Repository cloned." : "Repository initialized.",
  };
}

export function applyRepositoryCreationEvent(
  state: RepositoryCreationState,
  event: GitCreationEvent,
): RepositoryCreationState {
  if (state.kind !== "running" || state.operation !== event.operation) return state;
  if (state.requestId !== null && state.requestId !== event.requestId) return state;
  if (event.kind === "started") {
    return {
      ...state,
      requestId: event.requestId,
      phase: event.operation === "clone" ? "Cloning repository…" : "Initializing repository…",
    };
  }
  if (state.requestId === null) return state;
  if (event.kind === "progress") {
    return { ...state, phase: event.phase, percent: event.percent };
  }
  if (event.kind === "output") return state;
  if (event.kind === "completed") {
    return {
      kind: "completed",
      operation: event.operation,
      message: event.operation === "clone" ? "Repository cloned." : "Repository initialized.",
    };
  }
  if (event.kind === "failed") {
    return {
      kind: "failed",
      operation: event.operation,
      message: event.message,
    };
  }
  return {
    kind: "cancelled",
    operation: event.operation,
    message:
      event.reason === "timeout"
        ? "Repository creation timed out."
        : "Repository creation was cancelled.",
  };
}
