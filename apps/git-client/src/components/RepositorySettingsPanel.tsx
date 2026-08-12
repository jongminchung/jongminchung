import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@jongminchung/ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jongminchung/ui/components/tabs";
import { Textarea } from "@jongminchung/ui/components/textarea";
import { cn } from "@jongminchung/ui/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GitConfig,
  GitOperation,
  IgnoreRules,
  SubmoduleInfo,
} from "../shared/contracts/model";
import { useAppDialog } from "./AppDialog";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { EmptyState } from "./ProductCollections";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ProductSelect";

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

  const reload = useCallback(async (): Promise<void> => {
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
  }, [onLoadConfig, onLoadSubmodules, onReadIgnoreRules]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
    <div
      className={`repositorySettings [height:100%] [overflow:auto] repositorySettings`}
      aria-busy={busy}
    >
      <div
        className={`managementToolbar [&>_span]:[flex:1] [align-items:center] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:5px] [height:38px] [padding:0_11px] [&>_button]:[align-items:center] [&>_button]:[background:var(--card)] [&>_button]:[border:1px_solid_var(--border)] [&>_button]:rounded-sm [&>_button]:[display:flex] [&>_button]:[gap:5px] [&>_button]:[min-height:27px] [&>_button]:[padding:0_8px] [background:var(--card)] managementToolbar [&>_button]:rounded-sm`}
      >
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
          className={`settingsTabs [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:4px] [padding:8px_11px] [&>_button]:[background:transparent] [&>_button]:[min-height:29px] [&>_button]:[padding:0_10px] [&_em]:[color:var(--disabled-foreground)] [&_em]:[font-size:10px] [&_em]:[font-style:normal] [&_em]:[margin-left:4px] settingsTabs`}
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
        <TabsContent
          className={`settingsSection [border-bottom:1px_solid_var(--border)] [&>_header]:[align-items:center] [&>_header]:[background:var(--muted)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:8px] [&>_header]:[min-height:37px] [&>_header]:[padding:6px_11px] [&>_header_>_span]:[flex:1] [&_button]:[background:var(--secondary)] [&_button]:[border:1px_solid_var(--border)] [&_button]:[min-height:28px] [&_button]:[padding:0_8px] [&_input]:[background:var(--secondary)] [&_input]:[border:1px_solid_var(--border)] [&_input]:[min-height:28px] [&_input]:[padding:0_8px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)] [&_select]:[min-height:28px] [&_select]:[padding:0_8px] settingsSection`}
          render={<section />}
          value="ignore"
        >
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
          <div
            className={`ignoreEditors [display:grid] [gap:10px] [grid-template-columns:1fr_1fr] [padding:10px_11px] [&_label]:[color:var(--muted-foreground)] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[font-size:11px] [&_label]:[gap:5px] [&_textarea]:[background:var(--muted)] [&_textarea]:[border:1px_solid_var(--border)] [&_textarea]:rounded-lg [&_textarea]:[color:var(--foreground)] [&_textarea]:[font-family:var(--font-family-code)] [&_textarea]:[font-size:12px] [&_textarea]:[min-height:150px] [&_textarea]:[padding:8px] [&_textarea]:[resize:vertical] max-[1120px]:[grid-template-columns:1fr] ignoreEditors [&_textarea]:rounded-lg`}
          >
            <label>
              .gitignore
              <Textarea
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
              <Textarea
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
        <TabsContent
          className={`settingsSection [border-bottom:1px_solid_var(--border)] [&>_header]:[align-items:center] [&>_header]:[background:var(--muted)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:8px] [&>_header]:[min-height:37px] [&>_header]:[padding:6px_11px] [&>_header_>_span]:[flex:1] [&_button]:[background:var(--secondary)] [&_button]:[border:1px_solid_var(--border)] [&_button]:[min-height:28px] [&_button]:[padding:0_8px] [&_input]:[background:var(--secondary)] [&_input]:[border:1px_solid_var(--border)] [&_input]:[min-height:28px] [&_input]:[padding:0_8px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)] [&_select]:[min-height:28px] [&_select]:[padding:0_8px] settingsSection`}
          render={<section />}
          value="submodules"
        >
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
            <EmptyState title="No submodules configured." />
          ) : (
            submodules.map((submodule) => (
              <article
                className={`settingRow [align-items:center] [border-top:1px_solid_var(--border)] [display:flex] [gap:8px] [min-height:48px] [padding:7px_11px] [&>_div]:[display:flex] [&>_div]:[flex:1] [&>_div]:[flex-direction:column] [&>_div]:[min-width:0] [&_small]:[color:var(--disabled-foreground)] [&_small]:[overflow:hidden] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] settingRow`}
                key={submodule.path}
              >
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
        <TabsContent
          className={`settingsSection [border-bottom:1px_solid_var(--border)] [&>_header]:[align-items:center] [&>_header]:[background:var(--muted)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[display:flex] [&>_header]:[gap:8px] [&>_header]:[min-height:37px] [&>_header]:[padding:6px_11px] [&>_header_>_span]:[flex:1] [&_button]:[background:var(--secondary)] [&_button]:[border:1px_solid_var(--border)] [&_button]:[min-height:28px] [&_button]:[padding:0_8px] [&_input]:[background:var(--secondary)] [&_input]:[border:1px_solid_var(--border)] [&_input]:[min-height:28px] [&_input]:[padding:0_8px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)] [&_select]:[min-height:28px] [&_select]:[padding:0_8px] settingsSection`}
          render={<section />}
          value="config"
        >
          <header>
            <strong>Git config</strong>
            <span />
            <Select
              onValueChange={(value) => value && setScopeFilter(value as typeof scopeFilter)}
              value={scopeFilter}
            >
              <SelectTrigger
                aria-label="Filter Git config scope"
                className="bg-secondary"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All scopes</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label="Filter Git config"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter keys or values"
              value={filter}
            />
          </header>
          <div
            className={`configComposer [display:grid] [gap:8px] [grid-template-columns:minmax(180px,_1fr)_minmax(220px,_2fr)_auto] [padding:9px_11px] configComposer`}
          >
            <Input
              aria-label="Config key"
              onChange={(event) => setKey(event.target.value)}
              placeholder="user.email"
              value={key}
            />
            <Input
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
          <Table aria-label="Git config values" className="min-w-[660px] table-fixed text-xs">
            <TableHeader className="sticky top-0 z-10 bg-muted text-muted-foreground">
              <TableRow>
                <TableHead className="w-[24%]">Key</TableHead>
                <TableHead className="w-[28%]">Value</TableHead>
                <TableHead className="w-[75px]">Scope</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead className="w-[68px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConfig.map((entry) => (
                <TableRow key={`${entry.scope}-${entry.origin}-${entry.key}`}>
                  <TableCell className="truncate font-mono">{entry.key}</TableCell>
                  <TableCell className="truncate">{entry.value}</TableCell>
                  <TableCell className="truncate">{entry.scope ?? "unknown"}</TableCell>
                  <TableCell className="truncate text-muted-foreground">{entry.origin}</TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
      {dialog.node}
    </div>
  );
}
