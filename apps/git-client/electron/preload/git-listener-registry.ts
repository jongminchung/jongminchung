import { ipcRenderer } from "electron";
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
import { IPC_CHANNELS } from "../../src/shared/contracts/ipc";

const queryListeners = new Map<GitRequestId, GitEventListener>();

const queryTerminalWaiters = new Map<GitRequestId, () => void>();

const creationListeners = new Map<GitRequestId, GitCreationEventListener>();

const repositoryListeners = new Map<RepositoryId, RepositoryChangedListener>();

function deliverGitEvent(listener: GitEventListener, event: GitRequestEvent): void {
  try {
    listener(event);
  } catch {
    // A renderer callback cannot be allowed to interrupt IPC cleanup or later query events.
  }
}

ipcRenderer.on(IPC_CHANNELS.gitQueryEvent, (_event, raw: unknown): void => {
  const gitEvent = GitRequestEventSchema.parse(raw);
  const listener = queryListeners.get(gitEvent.requestId);
  if (listener === undefined) return;
  deliverGitEvent(listener, gitEvent);
  if (
    gitEvent.kind === "completed" ||
    gitEvent.kind === "failed" ||
    gitEvent.kind === "cancelled"
  ) {
    queryTerminalWaiters.get(gitEvent.requestId)?.();
    queryTerminalWaiters.delete(gitEvent.requestId);
    queryListeners.delete(gitEvent.requestId);
  }
});

async function waitForGitTerminalEvent(terminalEvent: Promise<void>): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    terminalEvent,
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, 100);
    }),
  ]);
  if (timeout !== undefined) clearTimeout(timeout);
}

function deliverGitCreationEvent(
  listener: GitCreationEventListener,
  event: GitCreationEvent,
): void {
  try {
    listener(event);
  } catch {
    // A renderer callback cannot interrupt IPC cleanup or later creation events.
  }
}

ipcRenderer.on(IPC_CHANNELS.gitCreationEvent, (_event, raw: unknown): void => {
  const creationEvent = GitCreationEventSchema.parse(raw);
  const listener = creationListeners.get(creationEvent.requestId);
  if (listener === undefined) return;
  deliverGitCreationEvent(listener, creationEvent);
  if (
    creationEvent.kind === "completed" ||
    creationEvent.kind === "failed" ||
    creationEvent.kind === "cancelled"
  ) {
    creationListeners.delete(creationEvent.requestId);
  }
});

ipcRenderer.on(IPC_CHANNELS.gitRepositoryChanged, (_event, raw: unknown): void => {
  const repositoryEvent = RepositoryChangedEventSchema.parse(raw);
  const listener = repositoryListeners.get(repositoryEvent.repositoryId);
  if (listener === undefined) return;
  try {
    listener(repositoryEvent);
  } catch {
    // A renderer callback cannot interrupt watcher cleanup or future repository events.
  }
});

export const gitListenerRegistry = {
  creationListeners,
  deliverGitEvent,
  queryListeners,
  queryTerminalWaiters,
  repositoryListeners,
  waitForGitTerminalEvent,
};
