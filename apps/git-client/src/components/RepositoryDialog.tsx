import { useState } from "react";
import { isTauriRuntime } from "../bridge/GitBridge";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

type Mode = "open" | "clone" | "init";

export function RepositoryDialog({
  onClose,
  onOpen,
  onClone,
  onInit,
}: {
  readonly onClose: () => void;
  readonly onOpen: (path: string) => void;
  readonly onClone: (url: string, path: string, depth: number | null) => void;
  readonly onInit: (path: string, bare: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("open");
  const [path, setPath] = useState("");
  const [url, setUrl] = useState("");
  const [shallow, setShallow] = useState(false);
  const [bare, setBare] = useState(false);

  const browse = async () => {
    if (!isTauriRuntime()) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose Repository Directory",
    });
    if (typeof selected === "string") setPath(selected);
  };
  const submit = () => {
    if (!path) return;
    if (mode === "open") onOpen(path);
    else if (mode === "clone" && url) onClone(url, path, shallow ? 1 : null);
    else if (mode === "init") onInit(path, bare);
    onClose();
  };

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section
        aria-label="Add repository"
        aria-modal="true"
        className={styles.repositoryDialog}
        role="dialog"
      >
        <header>
          <strong>Repository</strong>
          <span />
          <button
            aria-label="Close repository dialog"
            className={styles.iconButton}
            onClick={onClose}
          >
            <Icon name="close" size={15} />
          </button>
        </header>
        <nav>
          {(["open", "clone", "init"] as const).map((item) => (
            <button
              className={mode === item ? styles.activeRepositoryMode : undefined}
              key={item}
              onClick={() => setMode(item)}
            >
              {item === "open" ? "Open Existing" : item === "clone" ? "Clone" : "Initialize"}
            </button>
          ))}
        </nav>
        <div className={styles.repositoryForm}>
          {mode === "clone" && (
            <label>
              Remote URL
              <input
                onChange={(event) => setUrl(event.target.value)}
                placeholder="git@github.com:owner/repository.git"
                value={url}
              />
            </label>
          )}
          <label>
            {mode === "clone" ? "Empty destination" : "Directory"}
            <span>
              <input
                onChange={(event) => setPath(event.target.value)}
                placeholder="/Users/you/Code/repository"
                value={path}
              />
              <button onClick={() => void browse()}>Browse…</button>
            </span>
          </label>
          {mode === "clone" && (
            <label className={styles.repositoryOption}>
              <input
                checked={shallow}
                onChange={(event) => setShallow(event.target.checked)}
                type="checkbox"
              />
              Shallow clone (depth 1)
            </label>
          )}
          {mode === "init" && (
            <label className={styles.repositoryOption}>
              <input
                checked={bare}
                onChange={(event) => setBare(event.target.checked)}
                type="checkbox"
              />
              Bare repository
            </label>
          )}
        </div>
        <footer>
          <button onClick={onClose}>Cancel</button>
          <button
            className={styles.primaryButton}
            disabled={!path || (mode === "clone" && !url)}
            onClick={submit}
          >
            {mode === "open" ? "Open" : mode === "clone" ? "Clone" : "Initialize"}
          </button>
        </footer>
      </section>
    </div>
  );
}
