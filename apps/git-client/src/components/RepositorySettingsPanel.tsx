import { Button } from "@jongminchung/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import { cn } from "@jongminchung/ui/lib/utils";
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
import { Notice } from "./Notice";

type RepositorySettingsTab = "ignore" | "submodules" | "config";

function isRepositorySettingsTab(value: unknown): value is RepositorySettingsTab {
  return value === "ignore" || value === "submodules" || value === "config";
}

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
  const [rules, setRules] = useState<IgnoreRules>({
    gitignore: "",
    infoExclude: "",
  });
  const [tab, setTab] = useState<RepositorySettingsTab>("ignore");
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
          <Button
            disabled={busy}
            onClick={() => void onOperation({ kind: "unshallow" })}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Unshallow
          </Button>
        )}
        <Button
          disabled={busy}
          onClick={() => void reload()}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          Reload
        </Button>
      </div>
      {error && (
        <Notice role="alert" size="sm" tone="destructive">
          {error}
        </Notice>
      )}
      {notice && (
        <Notice role="status" size="sm" tone="success">
          {notice}
        </Notice>
      )}
      <Tabs
        className="contents"
        onValueChange={(value) => {
          if (isRepositorySettingsTab(value)) setTab(value);
        }}
        value={tab}
      >
        <TabsList
          aria-label="Repository settings sections"
          className={tw.settingsTabs}
          render={<nav />}
        >
          <TabsTrigger
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 data-active:bg-accent data-active:text-foreground"
            value="ignore"
          >
            Ignore
          </TabsTrigger>
          <TabsTrigger
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 data-active:bg-accent data-active:text-foreground"
            value="submodules"
          >
            Submodules <em>{submodules.length}</em>
          </TabsTrigger>
          <TabsTrigger
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-sm border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/55 disabled:pointer-events-none disabled:opacity-45 data-active:bg-accent data-active:text-foreground"
            value="config"
          >
            Git Config
          </TabsTrigger>
        </TabsList>
        <TabsContent className={tw.settingsSection} render={<section />} value="ignore">
          <header>
            <strong>Ignore rules</strong>
            <span />{" "}
            <Button
              disabled={busy}
              onClick={() => void saveIgnoreRules()}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Save rules
            </Button>
          </header>
          <div className={tw.ignoreEditors}>
            <label>
              .gitignore
              <textarea
                value={rules.gitignore}
                onChange={(event) =>
                  setRules((current) => ({
                    ...current,
                    gitignore: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              .git/info/exclude
              <textarea
                value={rules.infoExclude}
                onChange={(event) =>
                  setRules((current) => ({
                    ...current,
                    infoExclude: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </TabsContent>
        <TabsContent className={tw.settingsSection} render={<section />} value="submodules">
          <header>
            <strong>Submodules · {submodules.length}</strong>
            <span />
            <Button
              disabled={busy}
              onClick={() =>
                void onOperation({
                  kind: "updateSubmodules",
                  init: true,
                  recursive: true,
                }).then(() => reload())
              }
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              <Icon name="refresh" size={13} /> Update recursively
            </Button>
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
        </TabsContent>
        <TabsContent className={tw.settingsSection} render={<section />} value="config">
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
            <Button
              disabled={busy || !key.trim()}
              onClick={() => void saveConfig()}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Set local value
            </Button>
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
                    <Button
                      onClick={() => void removeConfig(entry)}
                      type="button"
                      className={cn("h-7 px-2.5")}
                      variant="outline"
                      size="sm"
                    >
                      Unset
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      {dialog.node}
    </div>
  );
}
