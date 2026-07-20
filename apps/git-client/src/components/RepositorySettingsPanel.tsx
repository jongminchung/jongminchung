import { useEffect, useMemo, useState } from "react";
import type {
  GitConfig,
  GitOperation,
  IgnoreRules,
  SubmoduleInfo,
} from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { Icon } from "./Icon";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function RepositorySettingsPanel({
  isShallow,
  onLoadConfig,
  onLoadSubmodules,
  onOperation,
  onReadIgnoreRules,
  onWriteIgnoreRules,
}: {
  readonly isShallow: boolean;
  readonly onLoadConfig: () => Promise<readonly GitConfig[]>;
  readonly onLoadSubmodules: () => Promise<readonly SubmoduleInfo[]>;
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onReadIgnoreRules: () => Promise<IgnoreRules>;
  readonly onWriteIgnoreRules: (rules: IgnoreRules) => Promise<void>;
}) {
  const [config, setConfig] = useState<readonly GitConfig[]>([]);
  const [submodules, setSubmodules] = useState<readonly SubmoduleInfo[]>([]);
  const [rules, setRules] = useState<IgnoreRules>({ gitignore: "", infoExclude: "" });
  const [tab, setTab] = useState<"ignore" | "submodules" | "config">("ignore");
  const [filter, setFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "local" | "global" | "system">("all");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const dialog = useAppDialog();

  const reload = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      const [nextConfig, nextSubmodules, nextRules] = await Promise.all([
        onLoadConfig(),
        onLoadSubmodules(),
        onReadIgnoreRules(),
      ]);
      setConfig(nextConfig);
      setSubmodules(nextSubmodules);
      setRules(nextRules);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const filteredConfig = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return config.filter(
      (entry) =>
        (scopeFilter === "all" || entry.scope === scopeFilter) &&
        (!query || `${entry.key}\n${entry.value}\n${entry.origin}`.toLowerCase().includes(query)),
    );
  }, [config, filter, scopeFilter]);

  const saveConfig = async (): Promise<void> => {
    if (!key.trim()) {
      setError("Config key is required.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onOperation({ kind: "setConfig", key: key.trim(), value });
      setKey("");
      setValue("");
      setConfig(await onLoadConfig());
      setNotice("Repository config updated.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  const removeConfig = async (entry: GitConfig): Promise<void> => {
    const accepted = await dialog.confirm({
      title: `Unset ${entry.key}?`,
      description: "Removes the repository-local value. A global or system value may still apply.",
      impact: entry.value,
      confirmLabel: "Unset value",
      dangerous: true,
    });
    if (!accepted) return;
    await onOperation({ kind: "setConfig", key: entry.key, value: null });
    setConfig(await onLoadConfig());
  };

  const saveIgnoreRules = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await onWriteIgnoreRules(rules);
      setNotice("Ignore rules saved atomically.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={tw.repositorySettings} aria-busy={busy}>
      <div className={tw.managementToolbar}>
        <strong>Repository settings</strong>
        <span />
        {isShallow && (
          <button disabled={busy} onClick={() => void onOperation({ kind: "unshallow" })}>
            Unshallow
          </button>
        )}
        <button disabled={busy} onClick={() => void reload()}>
          Reload
        </button>
      </div>
      {error && (
        <div className={tw.collectionError} role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className={tw.hostingNotice} role="status">
          {notice}
        </div>
      )}
      <nav className={tw.settingsTabs} aria-label="Repository settings sections">
        <button
          className={tab === "ignore" ? tw.activeButton : undefined}
          onClick={() => setTab("ignore")}
        >
          Ignore
        </button>
        <button
          className={tab === "submodules" ? tw.activeButton : undefined}
          onClick={() => setTab("submodules")}
        >
          Submodules <em>{submodules.length}</em>
        </button>
        <button
          className={tab === "config" ? tw.activeButton : undefined}
          onClick={() => setTab("config")}
        >
          Git Config
        </button>
      </nav>
      {tab === "ignore" && (
        <section className={tw.settingsSection}>
          <header>
            <strong>Ignore rules</strong>
            <span />{" "}
            <button disabled={busy} onClick={() => void saveIgnoreRules()}>
              Save rules
            </button>
          </header>
          <div className={tw.ignoreEditors}>
            <label>
              .gitignore
              <textarea
                value={rules.gitignore}
                onChange={(event) =>
                  setRules((current) => ({ ...current, gitignore: event.target.value }))
                }
              />
            </label>
            <label>
              .git/info/exclude
              <textarea
                value={rules.infoExclude}
                onChange={(event) =>
                  setRules((current) => ({ ...current, infoExclude: event.target.value }))
                }
              />
            </label>
          </div>
        </section>
      )}
      {tab === "submodules" && (
        <section className={tw.settingsSection}>
          <header>
            <strong>Submodules · {submodules.length}</strong>
            <span />
            <button
              disabled={busy}
              onClick={() =>
                void onOperation({ kind: "updateSubmodules", init: true, recursive: true }).then(
                  () => reload(),
                )
              }
            >
              <Icon name="refresh" size={13} /> Update recursively
            </button>
          </header>
          {submodules.length === 0 ? (
            <p className={tw.emptyState}>No submodules configured.</p>
          ) : (
            submodules.map((submodule) => (
              <article className={tw.settingRow} key={submodule.path}>
                <Icon name="worktree" size={15} />
                <div>
                  <strong>{submodule.path}</strong>
                  <small>
                    {submodule.status} · {submodule.oid?.slice(0, 12) ?? "no commit"}
                    {submodule.branch ? ` · ${submodule.branch}` : ""}
                  </small>
                </div>
              </article>
            ))
          )}
        </section>
      )}
      {tab === "config" && (
        <section className={tw.settingsSection}>
          <header>
            <strong>Git config</strong>
            <span />
            <select
              aria-label="Filter Git config scope"
              onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}
              value={scopeFilter}
            >
              <option value="all">All scopes</option>
              <option value="local">Local</option>
              <option value="global">Global</option>
              <option value="system">System</option>
            </select>
            <input
              aria-label="Filter Git config"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter keys or values"
              value={filter}
            />
          </header>
          <div className={tw.configComposer}>
            <input
              aria-label="Config key"
              onChange={(event) => setKey(event.target.value)}
              placeholder="user.email"
              value={key}
            />
            <input
              aria-label="Config value"
              onChange={(event) => setValue(event.target.value)}
              placeholder="value"
              value={value}
            />
            <button disabled={busy || !key.trim()} onClick={() => void saveConfig()}>
              Set local value
            </button>
          </div>
          <div className={tw.configTable} role="table" aria-label="Git config values">
            <div role="row">
              <strong role="columnheader">Key</strong>
              <strong role="columnheader">Value</strong>
              <strong role="columnheader">Scope</strong>
              <strong role="columnheader">Origin</strong>
              <span />
            </div>
            {filteredConfig.map((entry) => (
              <div role="row" key={`${entry.scope}-${entry.origin}-${entry.key}`}>
                <code role="cell">{entry.key}</code>
                <span role="cell">{entry.value}</span>
                <span role="cell">{entry.scope ?? "unknown"}</span>
                <small role="cell">{entry.origin}</small>
                <span>
                  {entry.scope === "local" && (
                    <button onClick={() => void removeConfig(entry)}>Unset</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {dialog.node}
    </div>
  );
}
