import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { createHostingBridge } from "../bridge/createHostingBridge";
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
  HostingAccountConnection,
  HostingRequestComposer,
  HostingRequestDetails,
  HostingRequestList,
  type HostingRequestDraft,
} from "./hosting";
import {
  loadHostingAccounts,
  loadViewedFiles,
  persistHostingAccounts,
  persistViewedFiles,
} from "./hosting-persistence";
import { Icon } from "./Icon";
import { Notice } from "./Notice";
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
  const [project, setProject] = useState(coordinates?.project ?? "");
  const [items, setItems] = useState<readonly HostingChangeRequest[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [selected, setSelected] = useState<HostingChangeRequest>();
  const [files, setFiles] = useState<readonly HostingChangedFile[]>([]);
  const [timeline, setTimeline] = useState<readonly HostingTimelineEntry[]>([]);
  const [viewed, setViewed] = useState<ReadonlySet<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const inspectionSequence = useRef(0);

  const selectedAccount = accounts.find((account) => account.id === accountId);

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

  const connect = async (
    provider: HostingProviderKind,
    baseUrl: string,
    token: string,
  ): Promise<boolean> => {
    if (!token) {
      setError("Enter a personal access token. It will be stored in macOS Keychain.");
      return false;
    }
    setBusy("Verifying account");
    setError(undefined);
    try {
      const account = await hostingBridge.saveAccount(provider, baseUrl, token);
      const next = [...accounts.filter((item) => item.id !== account.id), account];
      setAccounts(next);
      setAccountId(account.id);
      await persistHostingAccounts(next);
      setNotice(`Connected ${account.login}. The token is stored in macOS Keychain.`);
      return true;
    } catch (connectError) {
      setError(errorMessage(connectError));
      return false;
    } finally {
      setBusy(undefined);
    }
  };

  const removeAccount = async (id: string): Promise<boolean> => {
    setBusy("Removing account");
    setError(undefined);
    try {
      await hostingBridge.deleteAccount(id);
      const next = accounts.filter((account) => account.id !== id);
      setAccounts(next);
      setAccountId(next[0]?.id ?? "");
      await persistHostingAccounts(next);
      return true;
    } catch (removeError) {
      setError(errorMessage(removeError));
      return false;
    } finally {
      setBusy(undefined);
    }
  };

  const create = async (draft: HostingRequestDraft): Promise<boolean> => {
    const response = await execute("Creating change request", {
      kind: "create",
      project: project.trim(),
      ...draft,
    });
    if (response?.kind !== "changeRequest") return false;
    setItems((current) => [response.item, ...current]);
    setShowCreate(false);
    setNotice(`Created #${response.item.number}.`);
    return true;
  };

  const submitReview = async (event: HostingReviewEvent, body: string): Promise<boolean> => {
    if (!selected) return false;
    const response = await execute("Submitting review", {
      kind: "review",
      project: project.trim(),
      number: selected.number,
      event,
      body,
    });
    if (response?.kind === "completed") {
      setNotice(response.message);
      await inspect(selected);
      return true;
    }
    return false;
  };

  const postComment = async (body: string): Promise<boolean> => {
    if (!selected || !body) return false;
    const response = await execute("Posting comment", {
      kind: "comment",
      project: project.trim(),
      number: selected.number,
      body,
    });
    if (response?.kind !== "completed") return false;
    setNotice(response.message);
    await inspect(selected);
    return true;
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

      <HostingAccountConnection
        accountId={accountId}
        accounts={accounts}
        busy={busy}
        initialBaseUrl={coordinates?.baseUrl ?? "https://github.com"}
        initialProvider={coordinates?.provider ?? "gitHub"}
        onConnect={connect}
        onRemove={removeAccount}
      />

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
        <HostingRequestComposer
          currentBranch={currentBranch}
          onCancel={() => setShowCreate(false)}
          onCreate={create}
        />
      )}

      <div
        className={`hostingColumns [display:grid] [flex:1] [grid-template-columns:minmax(230px,_34%)_minmax(0,_1fr)] [min-height:0] hostingColumns`}
      >
        <HostingRequestList
          items={items}
          nextPage={nextPage}
          onInspect={(item) => void inspect(item)}
          onLoadMore={(page) => void loadList(page, true)}
          selectedNumber={selected?.number ?? null}
        />
        <HostingRequestDetails
          files={files}
          onPostComment={postComment}
          onSubmitReview={submitReview}
          onToggleViewed={(path) => void toggleViewed(path)}
          onUpdateBranch={() => void updateBranch()}
          selected={selected}
          timeline={timeline}
          viewed={viewed}
        />
      </div>
    </div>
  );
}
