import { useEffect, useMemo, useState } from "react";
import type { StatusModel } from "../domain/types";
import type { GitLocalHistoryEntry } from "../shared/contracts/git-utility";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { Icon } from "./Icon";

export function LocalHistoryPanel({
  initialPath,
  status,
  loadHistory,
  loadDiff,
  onRestore,
  onCapture,
}: {
  readonly initialPath?: string;
  readonly status: StatusModel;
  readonly loadHistory: (path: string | null) => Promise<readonly GitLocalHistoryEntry[]>;
  readonly loadDiff: (entryId: string, path: string) => Promise<string>;
  readonly onRestore: (entryId: string, path: string) => Promise<void>;
  readonly onCapture: (label: string | null) => Promise<GitLocalHistoryEntry>;
}) {
  const [path, setPath] = useState(initialPath ?? status.changes[0]?.path ?? "");
  const [history, setHistory] = useState<readonly GitLocalHistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [patch, setPatch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useAppDialog();
  const selected = useMemo(
    () => history.find((entry) => entry.id === selectedId) ?? history[0] ?? null,
    [history, selectedId],
  );

  useEffect(() => {
    if (initialPath !== undefined) setPath(initialPath);
  }, [initialPath]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      setPatch("");
      try {
        const next = await loadHistory(path.trim() || null);
        if (!active) return;
        setHistory(next);
        setSelectedId(next[0]?.id ?? null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [loadHistory, path]);

  useEffect(() => {
    let active = true;
    if (!selected || !path.trim()) {
      setPatch("");
      return () => { active = false; };
    }
    setLoading(true);
    const load = async (): Promise<void> => {
      try {
        const nextPatch = await loadDiff(selected.id, path.trim());
        if (active) setPatch(nextPatch);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [loadDiff, path, selected?.id]);

  const restore = async (): Promise<void> => {
    if (!selected || !path.trim() || !patch.trim()) return;
    const accepted = await dialog.confirm({
      title: `Restore ${path.trim()}?`,
      description: `Restores the working-tree file to the Local History state from ${new Date(selected.createdAtMs).toLocaleString()}. The Git index is not changed.`,
      impact: patch.slice(0, 2_000),
      confirmLabel: "Restore",
      dangerous: true,
    });
    if (!accepted) return;
    setLoading(true);
    setError(null);
    try {
      await onRestore(selected.id, path.trim());
      const next = await loadHistory(path.trim());
      setHistory(next);
      setSelectedId(next[0]?.id ?? null);
      setPatch("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const putLabel = async (): Promise<void> => {
    const label = await dialog.input({
      title: "Put Label",
      label: "Label",
      confirmLabel: "Save Label",
    });
    if (!label) return;
    setLoading(true);
    setError(null);
    try {
      const captured = await onCapture(label);
      setHistory(await loadHistory(path.trim() || null));
      setSelectedId(captured.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={tw.localHistoryPanel} aria-label="Local History">
      <header>
        <strong>Local History</strong>
        <label>
          <Icon name="search" size={13} />
          <input
            aria-label="Local History path"
            list="local-history-paths"
            onChange={(event) => setPath(event.target.value)}
            placeholder="Project history"
            value={path}
          />
        </label>
        <datalist id="local-history-paths">
          {status.changes.map((file) => <option key={file.path} value={file.path} />)}
        </datalist>
        <button disabled={loading} onClick={() => void putLabel()}>Put Label…</button>
        <button disabled={loading || !selected || !path.trim() || !patch.trim()} onClick={() => void restore()}>Revert</button>
      </header>
      {error && <div className={tw.collectionError} role="alert">{error}</div>}
      <div className={tw.localHistoryContent} aria-busy={loading}>
        <aside aria-label="Local History revisions" role="listbox">
          {history.map((entry) => (
            <button
              aria-selected={selected?.id === entry.id}
              key={entry.id}
              onClick={() => setSelectedId(entry.id)}
              role="option"
            >
              <Icon name="history" size={13} />
              <span>
                <strong>{entry.label ?? (entry.paths.length === 0 ? "Project state" : `${entry.paths.length} changed file${entry.paths.length === 1 ? "" : "s"}`)}</strong>
                <small>{new Date(entry.createdAtMs).toLocaleString()}</small>
              </span>
              <code>{entry.id.slice(0, 8)}</code>
            </button>
          ))}
          {!loading && history.length === 0 && <p>No history found.</p>}
        </aside>
        <main>
          <header>
            <strong>{path.trim() || "Project History"}</strong>
            {selected && <code>{selected.id.slice(0, 12)}</code>}
          </header>
          {loading ? <div className={tw.emptyState}>Loading Local History…</div> : patch ? <pre>{patch}</pre> : <div className={tw.emptyState}>Select a revision to compare with the working tree.</div>}
        </main>
      </div>
      {dialog.node}
    </section>
  );
}
