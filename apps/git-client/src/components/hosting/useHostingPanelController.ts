import { useEffect, useMemo, useRef, useState } from "react";
import { createHostingBridge } from "../../bridge/createHostingBridge";
import { isElectronRuntime } from "../../platform/electron";
import type {
  HostingAccount,
  HostingChangeRequest,
  HostingChangedFile,
  HostingMergeReadiness,
  HostingOAuthPrompt,
  HostingProviderKind,
  HostingRequest,
  HostingResponse,
  HostingReviewEvent,
  HostingTimelineEntry,
} from "../../shared/contracts/model/index";
import {
  loadHostingAccounts,
  loadViewedFiles,
  openHostingUrl,
  persistHostingAccounts,
  persistViewedFiles,
} from "../hosting-persistence";
import type { HostingRequestDraft } from "./HostingRequestComposer";

interface RemoteCoordinates {
  readonly project: string;
  readonly provider?: HostingProviderKind;
  readonly baseUrl: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function inferRemoteCoordinates(
  remoteUrl?: string,
): RemoteCoordinates | undefined {
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
    host === "github.com"
      ? "gitHub"
      : host.includes("gitlab")
        ? "gitLab"
        : undefined;
  return { project, provider, baseUrl: `https://${host}` };
}

export class HostingInspectionSequence {
  #current = 0;

  begin(): number {
    this.#current += 1;
    return this.#current;
  }

  invalidate(): void {
    this.#current += 1;
  }

  isCurrent(sequence: number): boolean {
    return this.#current === sequence;
  }
}

export class HostingOAuthSequence {
  #current = 0;

  begin(): number {
    this.#current += 1;
    return this.#current;
  }

  invalidate(): void {
    this.#current += 1;
  }

  isCurrent(sequence: number): boolean {
    return this.#current === sequence;
  }
}

export function requiresExplicitOAuthClientId(
  provider: HostingProviderKind,
  baseUrl: string,
): boolean {
  try {
    const origin = new URL(baseUrl).origin.toLowerCase();
    return provider === "gitHub"
      ? origin !== "https://github.com"
      : origin !== "https://gitlab.com";
  } catch {
    return true;
  }
}

export function useHostingPanelController({
  remoteUrl,
  currentBranch,
}: {
  readonly remoteUrl?: string;
  readonly currentBranch?: string;
}) {
  const hostingBridge = useMemo(createHostingBridge, []);
  const coordinates = useMemo(
    () => inferRemoteCoordinates(remoteUrl),
    [remoteUrl],
  );
  const [accounts, setAccounts] = useState<readonly HostingAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [project, setProject] = useState(coordinates?.project ?? "");
  const [items, setItems] = useState<readonly HostingChangeRequest[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [selected, setSelected] = useState<HostingChangeRequest>();
  const [files, setFiles] = useState<readonly HostingChangedFile[]>([]);
  const [timeline, setTimeline] = useState<readonly HostingTimelineEntry[]>([]);
  const [mergeReadiness, setMergeReadiness] = useState<HostingMergeReadiness>();
  const [viewed, setViewed] = useState<ReadonlySet<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [oauthPrompt, setOAuthPrompt] = useState<HostingOAuthPrompt>();
  const inspectionSequence = useRef(new HostingInspectionSequence());
  const oauthSequence = useRef(new HostingOAuthSequence());
  const oauthSessionId = useRef<string | undefined>(undefined);
  const selectedAccount = accounts.find((account) => account.id === accountId);

  useEffect(() => {
    inspectionSequence.current.invalidate();
    setSelected(undefined);
    setFiles([]);
    setTimeline([]);
    setMergeReadiness(undefined);
    setViewed(new Set());
    setBusy(undefined);
  }, [accountId, project]);

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
        if (active)
          setError(
            `Could not restore hosting accounts: ${errorMessage(restoreError)}`,
          );
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [hostingBridge]);

  useEffect(
    () => () => {
      oauthSequence.current.invalidate();
      const sessionId = oauthSessionId.current;
      oauthSessionId.current = undefined;
      if (sessionId) void hostingBridge.cancelOAuth(sessionId).catch(() => {});
    },
    [hostingBridge],
  );

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

  const executeCompleted = async (
    operation: string,
    request: HostingRequest,
  ): Promise<boolean> => {
    const response = await execute(operation, request);
    if (response?.kind !== "completed") return false;
    setNotice(response.message);
    return true;
  };

  const loadList = async (page = 1, append = false): Promise<void> => {
    const projectName = project.trim();
    if (!projectName) {
      setError("Enter a project in owner/repository form.");
      return;
    }
    const response = await execute("Loading change requests", {
      kind: "list",
      project: projectName,
      page,
    });
    if (response?.kind !== "changeRequests") return;
    setItems((current) =>
      append ? [...current, ...response.items] : response.items,
    );
    setNextPage(response.nextPage);
  };

  const inspect = async (item: HostingChangeRequest): Promise<void> => {
    const sequence = inspectionSequence.current.begin();
    setSelected(item);
    setFiles([]);
    setTimeline([]);
    setMergeReadiness(undefined);
    setViewed(new Set());
    const projectName = project.trim();
    if (!projectName || !accountId) return;
    const serverViewedPromise: Promise<HostingResponse> =
      selectedAccount?.provider === "gitHub"
        ? hostingBridge.execute(accountId, {
            kind: "viewedFiles",
            project: projectName,
            number: item.number,
          })
        : Promise.resolve({ kind: "viewedFiles", paths: [] });
    const localViewedPromise =
      selectedAccount?.provider === "gitLab"
        ? loadViewedFiles(accountId, projectName, item.number)
        : Promise.resolve<ReadonlySet<string>>(new Set());
    setBusy(`Loading #${item.number}`);
    setError(undefined);
    try {
      const [
        detailResponse,
        fileResponse,
        timelineResponse,
        readinessResponse,
        serverViewedResponse,
        storedViewed,
      ] = await Promise.all([
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
        hostingBridge.execute(accountId, {
          kind: "mergeReadiness",
          project: projectName,
          number: item.number,
        }),
        serverViewedPromise,
        localViewedPromise,
      ]);
      if (!inspectionSequence.current.isCurrent(sequence)) return;
      if (detailResponse.kind === "changeRequest")
        setSelected(detailResponse.item);
      if (fileResponse.kind === "files") setFiles(fileResponse.items);
      if (timelineResponse.kind === "timeline")
        setTimeline(timelineResponse.items);
      if (readinessResponse.kind === "mergeReadiness")
        setMergeReadiness(readinessResponse.readiness);
      setViewed(
        selectedAccount?.provider === "gitHub" &&
          serverViewedResponse.kind === "viewedFiles"
          ? new Set(serverViewedResponse.paths)
          : storedViewed,
      );
    } catch (inspectError) {
      if (inspectionSequence.current.isCurrent(sequence))
        setError(errorMessage(inspectError));
    } finally {
      if (inspectionSequence.current.isCurrent(sequence)) setBusy(undefined);
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
        if (!selected.nodeId)
          throw new Error("The GitHub pull request identity is unavailable.");
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

  const persistConnectedAccount = async (
    account: HostingAccount,
    message: string,
  ): Promise<void> => {
    const next = [
      ...accounts.filter((item) => item.id !== account.id),
      account,
    ];
    setAccounts(next);
    setAccountId(account.id);
    await persistHostingAccounts(next);
    setNotice(message);
  };

  const connect = async (
    provider: HostingProviderKind,
    baseUrl: string,
    token: string,
  ): Promise<boolean> => {
    if (!token) {
      setError(
        "Enter a personal access token. It will be stored in macOS Keychain.",
      );
      return false;
    }
    setBusy("Verifying account");
    setError(undefined);
    try {
      const account = await hostingBridge.saveAccount(provider, baseUrl, token);
      await persistConnectedAccount(
        account,
        `Connected ${account.login}. The token is stored in macOS Keychain.`,
      );
      return true;
    } catch (connectError) {
      setError(errorMessage(connectError));
      return false;
    } finally {
      setBusy(undefined);
    }
  };

  const connectOAuth = async (
    provider: HostingProviderKind,
    baseUrl: string,
    clientId: string,
  ): Promise<boolean> => {
    const normalizedBaseUrl = baseUrl.trim();
    const normalizedClientId = clientId.trim();
    if (
      !normalizedClientId &&
      requiresExplicitOAuthClientId(provider, normalizedBaseUrl)
    ) {
      setError("Enter the OAuth app client ID for this self-hosted server.");
      return false;
    }

    const sequence = oauthSequence.current.begin();
    const previousSessionId = oauthSessionId.current;
    let startedSessionId: string | undefined;
    oauthSessionId.current = undefined;
    setOAuthPrompt(undefined);
    setBusy("Starting browser sign-in");
    setError(undefined);
    setNotice(undefined);
    try {
      if (previousSessionId) await hostingBridge.cancelOAuth(previousSessionId);
      const prompt = await hostingBridge.beginOAuth(
        provider,
        normalizedBaseUrl,
        normalizedClientId,
      );
      if (!oauthSequence.current.isCurrent(sequence)) {
        await hostingBridge.cancelOAuth(prompt.sessionId);
        return false;
      }

      startedSessionId = prompt.sessionId;
      oauthSessionId.current = prompt.sessionId;
      setOAuthPrompt(prompt);
      setBusy("Waiting for browser sign-in");
      await openHostingUrl(prompt.authorizationUrl);
      const account = await hostingBridge.awaitOAuth(prompt.sessionId);
      if (!oauthSequence.current.isCurrent(sequence)) return false;

      await persistConnectedAccount(
        account,
        `Connected ${account.login}. OAuth credentials are stored in macOS Keychain.`,
      );
      return true;
    } catch (connectError) {
      if (oauthSequence.current.isCurrent(sequence))
        setError(errorMessage(connectError));
      if (startedSessionId)
        await hostingBridge.cancelOAuth(startedSessionId).catch(() => {});
      return false;
    } finally {
      if (oauthSequence.current.isCurrent(sequence)) {
        oauthSessionId.current = undefined;
        setOAuthPrompt(undefined);
        setBusy(undefined);
      }
    }
  };

  const cancelOAuth = async (): Promise<void> => {
    oauthSequence.current.invalidate();
    const sessionId = oauthSessionId.current;
    oauthSessionId.current = undefined;
    setOAuthPrompt(undefined);
    setBusy("Canceling browser sign-in");
    setError(undefined);
    try {
      if (sessionId) await hostingBridge.cancelOAuth(sessionId);
      setNotice("Browser sign-in canceled.");
    } catch (cancelError) {
      setError(errorMessage(cancelError));
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

  const submitReview = async (
    event: HostingReviewEvent,
    body: string,
  ): Promise<boolean> => {
    if (!selected) return false;
    const completed = await executeCompleted("Submitting review", {
      kind: "review",
      project: project.trim(),
      number: selected.number,
      event,
      body,
    });
    if (completed) await inspect(selected);
    return completed;
  };

  const postComment = async (body: string): Promise<boolean> => {
    if (!selected || !body) return false;
    const completed = await executeCompleted("Posting comment", {
      kind: "comment",
      project: project.trim(),
      number: selected.number,
      body,
    });
    if (completed) await inspect(selected);
    return completed;
  };

  const updateBranch = async (): Promise<void> => {
    if (!selected) return;
    await executeCompleted("Updating branch", {
      kind: "updateBranch",
      project: project.trim(),
      number: selected.number,
    });
  };

  const syncFork = async (): Promise<void> => {
    if (!currentBranch) return;
    await executeCompleted("Synchronizing fork", {
      kind: "syncFork",
      project: project.trim(),
      branch: currentBranch,
    });
  };

  return {
    accountId,
    accounts,
    busy,
    cancelOAuth,
    connect,
    connectOAuth,
    coordinates,
    create,
    error,
    files,
    inspect,
    items,
    loadList,
    mergeReadiness,
    nextPage,
    notice,
    oauthPrompt,
    postComment,
    project,
    removeAccount,
    selected,
    selectedAccount,
    setAccountId,
    setProject,
    setShowCreate,
    showCreate,
    submitReview,
    syncFork,
    timeline,
    toggleViewed,
    updateBranch,
    viewed,
  };
}
