import {
  GitCreationEventSchema,
  GitRequestEventSchema,
  RepositoryChangedEventSchema,
  type GitCreationEvent,
  type GitCreationEventListener,
  type GitEventListener,
  type GitRequestEvent,
  type GitRequestId,
  type RepositoryChangedListener,
  type RepositoryId,
} from "../../src/shared/contracts/git-utility";
import { desktopStream } from "./desktop-stream-client";

const queryListeners = new Map<GitRequestId, GitEventListener>();
const creationListeners = new Map<GitRequestId, GitCreationEventListener>();
const repositoryListeners = new Map<RepositoryId, RepositoryChangedListener>();
const deliveredBarriers = new Set<string>();
const barrierWaiters = new Map<string, () => void>();

function barrierKey(
  operation: "query" | "creation",
  requestId: GitRequestId,
): string {
  return `${operation}:${requestId}`;
}

function deliver<T>(listener: (event: T) => void, event: T): void {
  try {
    listener(event);
  } catch {
    // A renderer callback cannot interrupt cleanup or later stream events.
  }
}

desktopStream.subscribe((envelope) => {
  switch (envelope.kind) {
    case "git.query.event": {
      const event = GitRequestEventSchema.parse(envelope.event);
      const listener = queryListeners.get(event.requestId);
      if (listener !== undefined) deliver(listener, event);
      return;
    }
    case "git.creation.event": {
      const event = GitCreationEventSchema.parse(envelope.event);
      const listener = creationListeners.get(event.requestId);
      if (listener !== undefined) deliver(listener, event);
      return;
    }
    case "repository.changed": {
      const event = RepositoryChangedEventSchema.parse(envelope.event);
      const listener = repositoryListeners.get(event.repositoryId);
      if (listener !== undefined) deliver(listener, event);
      return;
    }
    case "git.barrier": {
      const key = barrierKey(envelope.operation, envelope.requestId);
      const resolve = barrierWaiters.get(key);
      if (resolve === undefined) {
        deliveredBarriers.add(key);
      } else {
        barrierWaiters.delete(key);
        resolve();
      }
      return;
    }
    default:
      return;
  }
});

function waitForBarrier(
  operation: "query" | "creation",
  requestId: GitRequestId,
): Promise<void> {
  const key = barrierKey(operation, requestId);
  if (deliveredBarriers.delete(key)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (barrierWaiters.has(key)) {
      reject(
        new Error(`Git ${operation} barrier ${requestId} already has a waiter`),
      );
      return;
    }
    barrierWaiters.set(key, resolve);
  });
}

export const gitStreamEvents = {
  creationListeners,
  deliverCreationEvent(
    listener: GitCreationEventListener,
    event: GitCreationEvent,
  ): void {
    deliver(listener, event);
  },
  deliverQueryEvent(listener: GitEventListener, event: GitRequestEvent): void {
    deliver(listener, event);
  },
  queryListeners,
  repositoryListeners,
  waitForBarrier,
};
