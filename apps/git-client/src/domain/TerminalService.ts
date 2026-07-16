import { TauriTerminalBridge, type TerminalBridge } from "../bridge/TerminalBridge";
import type { RepositoryId, TerminalEvent, TerminalId } from "../generated";

const MAX_BACKLOG_BYTES = 2 * 1024 * 1024;

export interface TerminalSessionSnapshot {
  readonly key: string;
  readonly repositoryId: RepositoryId;
  readonly title: string;
  readonly terminalId: TerminalId | null;
  readonly status: "starting" | "running" | "exited" | "failed";
  readonly exitCode: number | null;
  readonly error: string | null;
}

interface TerminalSessionRecord {
  key: string;
  repositoryId: RepositoryId;
  title: string;
  terminalId: TerminalId | null;
  status: "starting" | "running" | "exited" | "failed";
  exitCode: number | null;
  error: string | null;
  events: TerminalEvent[];
  backlogBytes: number;
}

type Listener = () => void;
type EventListener = (event: TerminalEvent) => void;

export class TerminalService {
  readonly #bridge: TerminalBridge;
  readonly #sessions = new Map<string, TerminalSessionRecord>();
  readonly #listeners = new Set<Listener>();
  readonly #eventListeners = new Map<string, Set<EventListener>>();
  readonly #restoredRepositories = new Set<string>();
  #version = 0;

  private constructor(bridge: TerminalBridge) {
    this.#bridge = bridge;
  }

  static of(bridge: TerminalBridge): TerminalService {
    return new TerminalService(bridge);
  }

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  snapshot = (): number => this.#version;

  sessions(repositoryId: RepositoryId): readonly TerminalSessionSnapshot[] {
    return [...this.#sessions.values()]
      .filter((session) => session.repositoryId === repositoryId)
      .map(({ events: _events, backlogBytes: _backlogBytes, ...session }) => session);
  }

  events(key: string): readonly TerminalEvent[] {
    return this.#sessions.get(key)?.events ?? [];
  }

  subscribeEvents(key: string, listener: EventListener): () => void {
    const listeners = this.#eventListeners.get(key) ?? new Set<EventListener>();
    listeners.add(listener);
    this.#eventListeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#eventListeners.delete(key);
    };
  }

  async create(repositoryId: RepositoryId, title?: string): Promise<string> {
    const key = crypto.randomUUID();
    const record: TerminalSessionRecord = {
      key,
      repositoryId,
      title: title ?? `Terminal ${this.sessions(repositoryId).length + 1}`,
      terminalId: null,
      status: "starting",
      exitCode: null,
      error: null,
      events: [],
      backlogBytes: 0,
    };
    this.#sessions.set(key, record);
    this.#notify();
    try {
      const terminalId = await this.#bridge.create(repositoryId, 100, 28, (event) =>
        this.#receive(key, event),
      );
      const session = this.#sessions.get(key);
      if (session) {
        session.terminalId = terminalId;
        session.status = "running";
        this.#notify();
        void this.#persist();
      } else {
        await this.#bridge.close(terminalId);
      }
      return key;
    } catch (error) {
      record.status = "failed";
      record.error = error instanceof Error ? error.message : String(error);
      this.#notify();
      return key;
    }
  }

  async write(key: string, data: string): Promise<void> {
    const terminalId = this.#sessions.get(key)?.terminalId;
    if (terminalId) await this.#bridge.write(terminalId, data);
  }

  async resize(key: string, cols: number, rows: number): Promise<void> {
    const terminalId = this.#sessions.get(key)?.terminalId;
    if (terminalId) await this.#bridge.resize(terminalId, cols, rows);
  }

  async close(key: string): Promise<void> {
    const session = this.#sessions.get(key);
    this.#sessions.delete(key);
    this.#eventListeners.delete(key);
    this.#notify();
    if (session?.terminalId) await this.#bridge.close(session.terminalId);
    await this.#persist();
  }

  async closeRepository(repositoryId: RepositoryId): Promise<void> {
    for (const session of this.sessions(repositoryId)) {
      this.#sessions.delete(session.key);
      this.#eventListeners.delete(session.key);
    }
    this.#notify();
    await this.#bridge.closeRepository(repositoryId);
    await this.#persist();
  }

  count(repositoryId: RepositoryId): number {
    return this.sessions(repositoryId).filter((session) => session.status === "running").length;
  }

  async restore(repositoryId: RepositoryId): Promise<void> {
    if (this.#restoredRepositories.has(repositoryId)) return;
    this.#restoredRepositories.add(repositoryId);
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json", { autoSave: 200, defaults: {} });
      const stored = await store.get<unknown>("terminalTabsByRepository");
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
      const titles = Reflect.get(stored, repositoryId);
      if (!Array.isArray(titles)) return;
      for (const title of titles.filter((value): value is string => typeof value === "string")) {
        await this.create(repositoryId, title);
      }
    } catch {
      // Terminal restoration is non-critical; a new session can still be created manually.
    }
  }

  #receive(key: string, event: TerminalEvent): void {
    const session = this.#sessions.get(key);
    if (!session) return;
    session.events.push(event);
    if (event.kind === "output") {
      session.backlogBytes += event.data.length;
      while (session.backlogBytes > MAX_BACKLOG_BYTES) {
        const removed = session.events.shift();
        if (removed?.kind === "output") session.backlogBytes -= removed.data.length;
      }
    } else if (event.kind === "exited") {
      session.status = "exited";
      session.exitCode = event.exitCode;
    } else {
      session.status = "failed";
      session.error = event.message;
    }
    for (const listener of this.#eventListeners.get(key) ?? []) listener(event);
    this.#notify();
  }

  #notify(): void {
    this.#version += 1;
    for (const listener of this.#listeners) listener();
  }

  async #persist(): Promise<void> {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json", { autoSave: 200, defaults: {} });
      const value: Record<string, string[]> = {};
      for (const session of this.#sessions.values()) {
        value[session.repositoryId] = [...(value[session.repositoryId] ?? []), session.title];
      }
      await store.set("terminalTabsByRepository", value);
    } catch {
      // Live terminal sessions remain usable when metadata persistence fails.
    }
  }
}

export const terminalService = TerminalService.of(new TauriTerminalBridge());
