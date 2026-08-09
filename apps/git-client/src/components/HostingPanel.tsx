import { Button } from "@jongminchung/ui/components/button";
import { Checkbox } from "@jongminchung/ui/components/checkbox";
import { Input } from "@jongminchung/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jongminchung/ui/components/select";
import { Textarea } from "@jongminchung/ui/components/textarea";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createHostingBridge } from "../bridge/createHostingBridge";
import {
  adjacentHostingChangeRequest,
  filterHostingChangeRequests,
  type HostingListScope,
} from "../domain/hostingView";
import { isElectronRuntime } from "../platform/electron";
import type {
  HostingAccount,
  HostingChangeRequest,
  HostingChangedFile,
  HostingProviderKind,
  HostingRequest,
  HostingResponse,
  HostingReviewEvent,
  HostingTimelineEntry,
} from "../shared/contracts/model";
import {
  loadHostingAccounts,
  loadViewedFiles,
  openHostingUrl,
  persistHostingAccounts,
  persistViewedFiles,
} from "./hosting-persistence";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
import { EmptyState } from "./ProductCollections";
import { Selector } from "./ProductFormControls";

interface RemoteCoordinates {
  readonly project: string;
  readonly provider?: HostingProviderKind;
  readonly baseUrl: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inferRemoteCoordinates(remoteUrl?: string): RemoteCoordinates | undefined {
  if (!remoteUrl) return undefined;
  const normalized = remoteUrl.trim().replace(/\.git$/, "");
  let host: string;
  let project: string;
  try {
    if (normalized.includes("://")) {
      const url = new URL(normalized);
      host = url.hostname.toLowerCase();
      project = url.pathname.replace(/^\//, "");
    } else {
      const match = /^(?:[^@]+@)?([^:]+):(.+)$/.exec(normalized);
      if (!match?.[1] || !match[2]) return undefined;
      host = match[1].toLowerCase();
      project = match[2];
    }
  } catch {
    return undefined;
  }
  if (!host || !project) return undefined;
  const provider =
    host === "github.com" ? "gitHub" : host.includes("gitlab") ? "gitLab" : undefined;
  return { project, provider, baseUrl: `https://${host}` };
}

export function HostingPanel({
  remoteUrl,
  currentBranch,
}: {
  readonly remoteUrl?: string;
  readonly currentBranch?: string;
}) {
  const hostingBridge = useMemo(createHostingBridge, []);
  const coordinates = useMemo(() => inferRemoteCoordinates(remoteUrl), [remoteUrl]);
  const [accounts, setAccounts] = useState<readonly HostingAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [provider, setProvider] = useState<HostingProviderKind>(coordinates?.provider ?? "gitHub");
  const [baseUrl, setBaseUrl] = useState(coordinates?.baseUrl ?? "https://github.com");
  const [token, setToken] = useState("");
  const [project, setProject] = useState(coordinates?.project ?? "");
  const [items, setItems] = useState<readonly HostingChangeRequest[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [selected, setSelected] = useState<HostingChangeRequest>();
  const [listQuery, setListQuery] = useState("");
  const [listScope, setListScope] = useState<HostingListScope>("open");
  const [files, setFiles] = useState<readonly HostingChangedFile[]>([]);
  const [timeline, setTimeline] = useState<readonly HostingTimelineEntry[]>([]);
  const [viewed, setViewed] = useState<ReadonlySet<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourceBranch, setSourceBranch] = useState(currentBranch ?? "");
  const [targetBranch, setTargetBranch] = useState("main");
  const [draft, setDraft] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [discussionBody, setDiscussionBody] = useState("");
  const [removeAccountId, setRemoveAccountId] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const inspectionSequence = useRef(0);

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const visibleItems = useMemo(
    () => filterHostingChangeRequests(items, listQuery, listScope),
    [items, listQuery, listScope],
  );

  useEffect(() => {
    if (!isElectronRuntime()) return;
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const restored = await loadHostingAccounts();
        await hostingBridge.restoreAccounts(restored);
        if (active) {
          setAccounts(restored);
          setAccountId(restored[0]?.id ?? "");
        }
      } catch (restoreError) {
        if (active) setError(`Could not restore hosting accounts: ${errorMessage(restoreError)}`);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [hostingBridge]);

  const execute = async (
    operation: string,
    request: HostingRequest,
  ): Promise<HostingResponse | undefined> => {
    if (!accountId) {
      setError("Connect or select a hosting account first.");
      return undefined;
    }
    setBusy(operation);
    setError(undefined);
    setNotice(undefined);
    try {
      return await hostingBridge.execute(accountId, request);
    } catch (requestError) {
      setError(errorMessage(requestError));
      return undefined;
    } finally {
      setBusy(undefined);
    }
  };

  const loadList = async (page = 1, append = false): Promise<void> => {
    if (!project.trim()) {
      setError("Enter a project in owner/repository form.");
      return;
    }
    const response = await execute("Loading change requests", {
      kind: "list",
      project: project.trim(),
      page,
    });
    if (response?.kind !== "changeRequests") return;
    setItems((current) => (append ? [...current, ...response.items] : response.items));
    setNextPage(response.nextPage);
  };

  const inspect = async (item: HostingChangeRequest): Promise<void> => {
    const sequence = inspectionSequence.current + 1;
    inspectionSequence.current = sequence;
    setSelected(item);
    setFiles([]);
    setTimeline([]);
    setViewed(new Set());
    const projectName = project.trim();
    if (!projectName || !accountId) return;
    const account = accounts.find((candidate) => candidate.id === accountId);
    const serverViewedPromise: Promise<HostingResponse> =
      account?.provider === "gitHub"
        ? hostingBridge.execute(accountId, {
            kind: "viewedFiles",
            project: projectName,
            number: item.number,
          })
        : Promise.resolve({ kind: "viewedFiles", paths: [] });
    const localViewedPromise =
      account?.provider === "gitLab"
        ? loadViewedFiles(accountId, projectName, item.number)
        : Promise.resolve<ReadonlySet<string>>(new Set());
    setBusy(`Loading #${item.number}`);
    setError(undefined);
    try {
      const [detailResponse, fileResponse, timelineResponse, serverViewedResponse, storedViewed] =
        await Promise.all([
          hostingBridge.execute(accountId, {
            kind: "get",
            project: projectName,
            number: item.number,
          }),
          hostingBridge.execute(accountId, {
            kind: "files",
            project: projectName,
            number: item.number,
          }),
          hostingBridge.execute(accountId, {
            kind: "timeline",
            project: projectName,
            number: item.number,
          }),
          serverViewedPromise,
          localViewedPromise,
        ]);
      if (inspectionSequence.current !== sequence) return;
      if (detailResponse.kind === "changeRequest") setSelected(detailResponse.item);
      if (fileResponse.kind === "files") setFiles(fileResponse.items);
      if (timelineResponse.kind === "timeline") setTimeline(timelineResponse.items);
      setViewed(
        account?.provider === "gitHub" && serverViewedResponse.kind === "viewedFiles"
          ? new Set(serverViewedResponse.paths)
          : storedViewed,
      );
    } catch (inspectError) {
      if (inspectionSequence.current === sequence) setError(errorMessage(inspectError));
    } finally {
      if (inspectionSequence.current === sequence) setBusy(undefined);
    }
  };

  const toggleViewed = async (path: string): Promise<void> => {
    if (!selected || !accountId) return;
    const projectName = project.trim();
    if (!projectName) return;
    const next = new Set(viewed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setViewed(next);
    try {
      if (selectedAccount?.provider === "gitHub") {
        if (!selected.nodeId) throw new Error("The GitHub pull request identity is unavailable.");
        const response = await hostingBridge.execute(accountId, {
          kind: "setViewed",
          pullRequestId: selected.nodeId,
          path,
          viewed: next.has(path),
        });
        if (response.kind !== "completed")
          throw new Error("GitHub did not update the viewed state.");
      } else {
        await persistViewedFiles(accountId, projectName, selected.number, next);
      }
    } catch (persistError) {
      setViewed(viewed);
      setError(`Could not update viewed files: ${errorMessage(persistError)}`);
    }
  };

  const connect = async (): Promise<void> => {
    if (!token.trim()) {
      setError("Enter a personal access token. It will be stored in macOS Keychain.");
      return;
    }
    setBusy("Verifying account");
    setError(undefined);
    try {
      const account = await hostingBridge.saveAccount(provider, baseUrl.trim(), token.trim());
      const next = [...accounts.filter((item) => item.id !== account.id), account];
      setToken("");
      setAccounts(next);
      setAccountId(account.id);
      await persistHostingAccounts(next);
      setNotice(`Connected ${account.login}. The token is stored in macOS Keychain.`);
    } catch (connectError) {
      setError(errorMessage(connectError));
    } finally {
      setBusy(undefined);
    }
  };

  const removeAccount = async (id: string): Promise<void> => {
    setBusy("Removing account");
    setError(undefined);
    try {
      await hostingBridge.deleteAccount(id);
      const next = accounts.filter((account) => account.id !== id);
      setAccounts(next);
      setAccountId(next[0]?.id ?? "");
      setRemoveAccountId(undefined);
      await persistHostingAccounts(next);
    } catch (removeError) {
      setError(errorMessage(removeError));
    } finally {
      setBusy(undefined);
    }
  };

  const create = async (): Promise<void> => {
    const response = await execute("Creating change request", {
      kind: "create",
      project: project.trim(),
      title: title.trim(),
      body,
      sourceBranch: sourceBranch.trim(),
      targetBranch: targetBranch.trim(),
      draft,
    });
    if (response?.kind !== "changeRequest") return;
    setItems((current) => [response.item, ...current]);
    setShowCreate(false);
    setTitle("");
    setBody("");
    setNotice(`Created #${response.item.number}.`);
  };

  const submitReview = async (event: HostingReviewEvent): Promise<void> => {
    if (!selected) return;
    const response = await execute("Submitting review", {
      kind: "review",
      project: project.trim(),
      number: selected.number,
      event,
      body: reviewBody,
    });
    if (response?.kind === "completed") {
      setReviewBody("");
      setNotice(response.message);
      await inspect(selected);
    }
  };

  const postComment = async (): Promise<void> => {
    if (!selected || !discussionBody.trim()) return;
    const response = await execute("Posting comment", {
      kind: "comment",
      project: project.trim(),
      number: selected.number,
      body: discussionBody.trim(),
    });
    if (response?.kind !== "completed") return;
    setDiscussionBody("");
    setNotice(response.message);
    await inspect(selected);
  };

  const updateBranch = async (): Promise<void> => {
    if (!selected) return;
    const response = await execute("Updating branch", {
      kind: "updateBranch",
      project: project.trim(),
      number: selected.number,
    });
    if (response?.kind === "completed") setNotice(response.message);
  };

  const syncFork = async (): Promise<void> => {
    if (!currentBranch) return;
    const response = await execute("Synchronizing fork", {
      kind: "syncFork",
      project: project.trim(),
      branch: currentBranch,
    });
    if (response?.kind === "completed") setNotice(response.message);
  };

  const navigateList = (event: KeyboardEvent<HTMLElement>): void => {
    const direction =
      event.key === "ArrowDown"
        ? "next"
        : event.key === "ArrowUp"
          ? "previous"
          : event.key === "Home"
            ? "first"
            : event.key === "End"
              ? "last"
              : null;
    if (direction === null) return;
    event.preventDefault();
    const next = adjacentHostingChangeRequest(visibleItems, selected?.number ?? null, direction);
    if (next) void inspect(next);
  };

  if (!isElectronRuntime()) {
    return (
      <section
        className={`collectionIntro [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:10px] [min-height:48px] [padding:8px_14px] [background:var(--muted)] [&_div]:[flex:1] [&_p]:[color:var(--muted-foreground)] [&_p]:[margin:2px_0_0] collectionIntro`}
      >
        <Icon name="globe" size={18} />
        <div>
          <strong>GitHub and GitLab require the native app</strong>
          <p>Browser preview does not expose account or credential operations.</p>
        </div>
      </section>
    );
  }

  return (
    <div
      className={`hostingPanel [display:flex] [flex-direction:column] [height:100%] [min-height:0] [&_input]:[background:var(--secondary)] [&_input]:[border:1px_solid_var(--border)] [&_input]:[min-height:29px] [&_input]:[padding:4px_8px] [&_select]:[background:var(--secondary)] [&_select]:[border:1px_solid_var(--border)] [&_select]:[min-height:29px] [&_select]:[padding:4px_8px] [&_textarea]:[background:var(--secondary)] [&_textarea]:[border:1px_solid_var(--border)] [&_textarea]:[min-height:29px] [&_textarea]:[padding:4px_8px] [&_button]:[align-items:center] [&_button]:[background:var(--secondary)] [&_button]:[border:1px_solid_var(--border)] [&_button]:[display:inline-flex] [&_button]:[gap:5px] [&_button]:[min-height:29px] [&_button]:[padding:0_9px] hostingPanel`}
      aria-busy={Boolean(busy)}
    >
      <section
        className={`hostingAccountBar [align-items:center] [display:flex] [gap:8px] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [min-height:52px] [padding:7px_11px] [&_label]:[color:var(--muted-foreground)] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[font-size:11px] [&_label]:[gap:3px] [&_label:nth-child(2)]:[flex:1] hostingAccountBar`}
      >
        <Selector
          className="bg-secondary"
          label="Account"
          onChange={setAccountId}
          options={[
            { label: "No account", value: "" },
            ...accounts.map((account) => ({
              label: `${account.login} · ${account.provider === "gitHub" ? "GitHub" : "GitLab"}`,
              value: account.id,
            })),
          ]}
          placeholder="No account"
          value={accountId}
        />
        <label>
          Project
          <Input
            aria-label="Hosting project"
            onChange={(event) => setProject(event.target.value)}
            placeholder="owner/repository"
            value={project}
          />
        </label>
        <Button
          disabled={!accountId || Boolean(busy)}
          onClick={() => void loadList()}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          <Icon name="refresh" size={13} /> Load
        </Button>
        <Button
          aria-controls="hosting-create-request"
          aria-expanded={showCreate}
          disabled={!accountId || !project.trim()}
          onClick={() => setShowCreate((value) => !value)}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          <Icon name="plus" size={13} /> New PR / MR
        </Button>
        {selectedAccount?.provider === "gitHub" && currentBranch && (
          <Button
            disabled={Boolean(busy) || !project.trim()}
            onClick={() => void syncFork()}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            <Icon name="refresh" size={13} /> Sync fork
          </Button>
        )}
      </section>

      <details
        className={`hostingConnect [border-bottom:1px_solid_var(--border)] [padding:8px_11px] [&_summary]:[color:var(--muted-foreground)] [&_summary]:[cursor:default] [&_summary]:[font-weight:600] hostingConnect`}
        open={accounts.length === 0}
      >
        <summary>Connect a GitHub or GitLab account</summary>
        <div
          className={`hostingFormGrid [&_label]:[color:var(--muted-foreground)] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[font-size:11px] [&_label]:[gap:3px] [align-items:end] [display:grid] [gap:8px] [grid-template-columns:110px_minmax(190px,_1fr)_minmax(190px,_1fr)_auto] [padding-top:9px] hostingFormGrid`}
        >
          <Selector
            className="bg-secondary"
            label="Provider"
            value={provider}
            onChange={(value) => {
              const next = value as HostingProviderKind;
              setProvider(next);
              setBaseUrl(next === "gitHub" ? "https://github.com" : "https://gitlab.com");
            }}
            options={[
              { label: "GitHub", value: "gitHub" },
              { label: "GitLab", value: "gitLab" },
            ]}
          />
          <label>
            Server URL
            <Input onChange={(event) => setBaseUrl(event.target.value)} value={baseUrl} />
          </label>
          <label>
            Personal access token
            <Input
              autoComplete="off"
              onChange={(event) => setToken(event.target.value)}
              type="password"
              value={token}
            />
          </label>
          <Button
            disabled={Boolean(busy)}
            onClick={() => void connect()}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            {busy === "Verifying account" ? "Verifying…" : "Connect and store in Keychain"}
          </Button>
        </div>
        {selectedAccount && (
          <div
            className={`hostingAccountMeta [align-items:center] [display:flex] [gap:8px] [border-top:1px_solid_var(--border)] [color:var(--muted-foreground)] [margin-top:9px] [padding-top:8px] [&>_span:first-child]:[flex:1] hostingAccountMeta`}
          >
            <span>
              {selectedAccount.login} · {selectedAccount.baseUrl}
            </span>
            {removeAccountId === selectedAccount.id ? (
              <>
                <span>Removes metadata and the Keychain credential.</span>
                <Button
                  onClick={() => void removeAccount(selectedAccount.id)}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Confirm remove
                </Button>
                <Button
                  onClick={() => setRemoveAccountId(undefined)}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setRemoveAccountId(selectedAccount.id)}
                type="button"
                className={cn("h-7 px-2.5")}
                variant="outline"
                size="sm"
              >
                Remove account
              </Button>
            )}
          </div>
        )}
      </details>

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
      {busy && (
        <div
          className={`hostingProgress [border-bottom:1px_solid_var(--border)] [padding:7px_12px] [color:var(--primary)] hostingProgress`}
        >
          {busy}…
        </div>
      )}

      {showCreate && (
        <section
          className={`hostingComposer [&>_footer]:[align-items:center] [&>_footer]:[display:flex] [&>_footer]:[gap:8px] [&_label]:[color:var(--muted-foreground)] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[font-size:11px] [&_label]:[gap:3px] [background:var(--secondary)] [border-bottom:1px_solid_var(--border)] [display:flex] [flex-direction:column] [gap:8px] [padding:11px] [&_textarea]:[min-height:64px] [&_textarea]:[resize:vertical] [&>_div]:[align-items:end] [&>_div]:[display:grid] [&>_div]:[gap:8px] [&>_div]:[grid-template-columns:1fr_1fr_auto] [&>_footer]:[justify-content:flex-end] hostingComposer`}
          id="hosting-create-request"
        >
          <strong>Create change request</strong>
          <label>
            Title
            <Input onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
          <label>
            Description
            <Textarea onChange={(event) => setBody(event.target.value)} value={body} />
          </label>
          <div>
            <label>
              Source
              <Input
                onChange={(event) => setSourceBranch(event.target.value)}
                value={sourceBranch}
              />
            </label>
            <label>
              Target
              <Input
                onChange={(event) => setTargetBranch(event.target.value)}
                value={targetBranch}
              />
            </label>
            <label
              className={`inlineCheck [align-items:center] [flex-direction:row]! [min-height:29px] [&_input]:[min-height:auto] inlineCheck`}
            >
              <Checkbox checked={draft} onCheckedChange={setDraft} /> Draft
            </label>
          </div>
          <footer>
            <Button
              onClick={() => setShowCreate(false)}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              disabled={!title.trim() || !sourceBranch.trim() || !targetBranch.trim()}
              onClick={() => void create()}
              type="button"
              className={cn("h-7 px-2.5")}
              variant="outline"
              size="sm"
            >
              Create
            </Button>
          </footer>
        </section>
      )}

      <div
        className={`hostingColumns [display:grid] [flex:1] [grid-template-columns:minmax(230px,_34%)_minmax(0,_1fr)] [min-height:0] hostingColumns`}
      >
        <section
          className={`hostingList [min-height:0] [overflow:auto] [border-right:1px_solid_var(--border)] [&>_button]:[align-items:stretch] [&>_button]:[background:transparent] [&>_button]:[border:0] [&>_button]:[border-bottom:1px_solid_var(--border)] [&>_button]:rounded-none [&>_button]:[display:flex] [&>_button]:[flex-direction:column] [&>_button]:[gap:4px] [&>_button]:[padding:10px_11px] [&>_button]:[text-align:left] [&>_button]:[width:100%] [&_small]:[color:var(--disabled-foreground)] hostingList [&>_button]:rounded-none`}
          aria-label="Pull and merge requests"
          onKeyDown={navigateList}
          tabIndex={0}
        >
          <div
            className={`hostingListToolbar [align-items:center] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:5px] [padding:5px] [position:sticky] [top:0] [z-index:2] [&>_label]:[align-items:center] [&>_label]:[background:var(--secondary)] [&>_label]:[border:1px_solid_var(--border)] [&>_label]:rounded-sm [&>_label]:[display:flex] [&>_label]:[flex:1] [&>_label]:[gap:5px] [&>_label]:[padding:0_6px] [&>_label_input]:[background:transparent] [&>_label_input]:[border:0] [&>_label_input]:[min-width:0] [&>_label_input]:[outline:0] [&>_label_input]:[padding:0] [&>_label_input]:[width:100%] [&>_select]:[width:78px] hostingListToolbar [&>_label]:rounded-sm`}
          >
            <label>
              <Icon name="search" size={13} />
              <Input
                aria-label="Filter pull and merge requests"
                onChange={(event) => setListQuery(event.target.value)}
                placeholder="Search"
                value={listQuery}
              />
            </label>
            <Select
              onValueChange={(value) => value && setListScope(value as HostingListScope)}
              value={listScope}
            >
              <SelectTrigger
                aria-label="Pull and merge request state"
                className="w-[78px] bg-secondary"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {items.length === 0 && (
            <EmptyState title="Load pull or merge requests for this project." />
          )}
          {items.length > 0 && visibleItems.length === 0 && (
            <EmptyState title="No pull or merge requests match the filter." />
          )}
          {visibleItems.map((item) => (
            <Button
              aria-current={selected?.number === item.number ? "true" : undefined}
              key={item.number}
              onClick={() => void inspect(item)}
              type="button"
              className="min-h-[29px] w-full justify-start gap-1.5 whitespace-normal px-2 py-1 text-left text-xs aria-current:bg-accent aria-current:text-foreground"
              variant="ghost"
              size="default"
            >
              <span>
                #{item.number} · {item.state}
                {item.draft ? " · draft" : ""}
              </span>
              <strong>{item.title}</strong>
              <small>
                {item.author} · {item.sourceBranch} → {item.targetBranch}
              </small>
            </Button>
          ))}
          {nextPage && (
            <Button
              onClick={() => void loadList(nextPage, true)}
              type="button"
              className="min-h-[29px] w-full items-center justify-start gap-1.5 whitespace-normal px-2 py-1 text-left text-xs text-primary"
              variant="ghost"
              size="default"
            >
              Load more
            </Button>
          )}
        </section>

        <section
          className={`hostingDetail [&>_header]:[align-items:center] [&>_header]:[display:flex] [&>_header]:[gap:8px] [min-height:0] [overflow:auto] [&_small]:[color:var(--disabled-foreground)] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header]:[padding:9px_11px] [&>_header_>_div]:[display:flex] [&>_header_>_div]:[flex:1] [&>_header_>_div]:[flex-direction:column] [&>_header_>_div]:[min-width:0] [&>_header_small]:[overflow:hidden] [&>_header_small]:[text-overflow:ellipsis] [&>_header_small]:[white-space:nowrap] [&_h3]:[color:var(--muted-foreground)] [&_h3]:[font-size:12px] [&_h3]:[margin:0] [&_h3]:[padding:10px_11px_6px] hostingDetail`}
          aria-label="Change request detail"
        >
          {!selected ? (
            <EmptyState title="Select a change request to inspect files and timeline." />
          ) : (
            <>
              <header>
                <div>
                  <strong>
                    #{selected.number} {selected.title}
                  </strong>
                  <small>{selected.webUrl}</small>
                </div>
                <Button
                  onClick={() => void navigator.clipboard.writeText(selected.webUrl)}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  <Icon name="copy" size={13} /> Copy link
                </Button>
                <a
                  href={selected.webUrl}
                  onClick={(event) => {
                    event.preventDefault();
                    void openHostingUrl(selected.webUrl);
                  }}
                  className={cn("h-7 px-2.5")}
                >
                  <Icon name="external" size={13} /> Open
                </a>
                <Button
                  onClick={() => void updateBranch()}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Update branch
                </Button>
              </header>
              <div
                className={`hostingReviewBar [align-items:center] [display:flex] [gap:8px] [border-bottom:1px_solid_var(--border)] [padding:8px_11px] [&_textarea]:[flex:1] [&_textarea]:[min-height:52px] [&_textarea]:[resize:vertical] hostingReviewBar`}
              >
                <Textarea
                  aria-label="Review body"
                  onChange={(event) => setReviewBody(event.target.value)}
                  placeholder="Review or comment"
                  value={reviewBody}
                />
                <Button
                  onClick={() => void submitReview("comment")}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Comment
                </Button>
                <Button
                  onClick={() => void submitReview("approve")}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Approve
                </Button>
                <Button
                  disabled={!reviewBody.trim()}
                  onClick={() => void submitReview("requestChanges")}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Request changes
                </Button>
              </div>
              <h3>Changed files · {files.length}</h3>
              {files.map((file) => (
                <article
                  className={`hostingFile [border-top:1px_solid_var(--border)] [padding:8px_11px] [&>_label]:[float:right] [&>_strong]:[display:block] [&>_small]:[display:block] [&_pre]:[background:var(--muted)] [&_pre]:[border:1px_solid_var(--border)] [&_pre]:rounded-lg [&_pre]:[font-size:12px] [&_pre]:[max-height:280px] [&_pre]:[overflow:auto] [&_pre]:[padding:9px] hostingFile [&_pre]:rounded-lg`}
                  key={file.path}
                >
                  <label>
                    <Checkbox
                      checked={viewed.has(file.path)}
                      onCheckedChange={() => void toggleViewed(file.path)}
                    />{" "}
                    Viewed
                  </label>
                  <strong>{file.path}</strong>
                  <small>
                    +{file.additions} −{file.deletions} · {file.status}
                  </small>
                  {file.patch && (
                    <pre aria-label={`Diff for ${file.path}`} tabIndex={0}>
                      <code>{file.patch}</code>
                    </pre>
                  )}
                </article>
              ))}
              <h3>Timeline · {timeline.length}</h3>
              {timeline.map((entry) => (
                <article
                  className={`hostingTimeline [border-top:1px_solid_var(--border)] [padding:8px_11px] [&_p]:[line-height:1.45] [&_p]:[margin:5px_0_0] [&_p]:[white-space:pre-wrap] [&_small]:[float:right] hostingTimeline`}
                  key={entry.id}
                >
                  <strong>{entry.author || entry.kind}</strong>
                  <small>{entry.createdAt}</small>
                  <p>{entry.body}</p>
                </article>
              ))}
              <div
                className={`hostingDiscussionComposer [align-items:flex-end] [border-top:1px_solid_var(--border)] [display:flex] [gap:8px] [padding:8px_11px] [&_textarea]:[flex:1] [&_textarea]:[min-height:54px] [&_textarea]:[resize:vertical] hostingDiscussionComposer`}
              >
                <Textarea
                  aria-label="Add timeline comment"
                  onChange={(event) => setDiscussionBody(event.target.value)}
                  placeholder="Add a comment"
                  value={discussionBody}
                />
                <Button
                  disabled={!discussionBody.trim()}
                  onClick={() => void postComment()}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  Comment
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
