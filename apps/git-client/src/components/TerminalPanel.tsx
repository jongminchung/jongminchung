import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { isTauriRuntime } from "../bridge/GitBridge";
import { terminalService } from "../domain/TerminalService";
import type { RepositoryId } from "../generated";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

const XtermSurface = lazy(() => import("./XtermSurface"));

export function TerminalPanel({
  repositoryId,
  fixture,
}: {
  readonly repositoryId: RepositoryId;
  readonly fixture: boolean;
}) {
  useSyncExternalStore(
    terminalService.subscribe,
    terminalService.snapshot,
    terminalService.snapshot,
  );
  const sessions = terminalService.sessions(repositoryId);
  const [activeKey, setActiveKey] = useState<string | null>(sessions[0]?.key ?? null);

  useEffect(() => {
    if (fixture || !isTauriRuntime()) return;
    void terminalService.restore(repositoryId);
  }, [fixture, repositoryId]);

  useEffect(() => {
    if (!sessions.some((session) => session.key === activeKey)) {
      setActiveKey(sessions[0]?.key ?? null);
    }
  }, [activeKey, sessions]);

  const create = async (): Promise<void> => {
    if (fixture || !isTauriRuntime()) return;
    if (localStorage.getItem("terminalSecurityAcknowledged") !== "true") {
      const accepted = window.confirm(
        "Terminal runs your default shell with your user permissions. Commands are not restricted or recorded in Git Console. Continue?",
      );
      if (!accepted) return;
      localStorage.setItem("terminalSecurityAcknowledged", "true");
    }
    setActiveKey(await terminalService.create(repositoryId));
  };

  if (fixture || !isTauriRuntime()) {
    return (
      <div className={styles.terminalEmpty}>
        <Icon name="console" size={22} />
        <strong>Native Terminal</strong>
        <p>The QA fixture does not start a shell. Run the Tauri app to use a real PTY.</p>
      </div>
    );
  }

  return (
    <div className={styles.terminalTool}>
      <div className={styles.terminalTabs}>
        {sessions.map((session) => (
          <button
            className={activeKey === session.key ? styles.activeTerminalTab : undefined}
            key={session.key}
            onClick={() => setActiveKey(session.key)}
          >
            <span className={`${styles.consoleStatus} ${styles[session.status]}`} />
            {session.title}
            <span
              aria-label={`Close ${session.title}`}
              onClick={(event) => {
                event.stopPropagation();
                void terminalService.close(session.key);
              }}
              role="button"
            >
              ×
            </span>
          </button>
        ))}
        <button aria-label="New terminal" onClick={() => void create()}>
          <Icon name="plus" size={13} />
        </button>
      </div>
      <div className={styles.terminalSurface}>
        {activeKey ? (
          <Suspense fallback={<div className={styles.emptyState}>Starting terminal…</div>}>
            <XtermSurface sessionKey={activeKey} />
          </Suspense>
        ) : (
          <div className={styles.terminalEmpty}>
            <Icon name="console" size={22} />
            <strong>No terminal session</strong>
            <button onClick={() => void create()}>New Terminal</button>
          </div>
        )}
      </div>
    </div>
  );
}
