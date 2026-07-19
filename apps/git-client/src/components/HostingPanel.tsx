import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createHostingBridge } from "../bridge/createHostingBridge";
import type {
    HostingAccount,
    HostingChangeRequest,
    HostingChangedFile,
    HostingProviderKind,
    HostingRequest,
    HostingResponse,
    HostingReviewEvent,
    HostingTimelineEntry,
} from "../generated";
import { isNativeRuntime } from "../platform/electron";
import {
    adjacentHostingChangeRequest,
    filterHostingChangeRequests,
    type HostingListScope,
} from "../domain/hostingView";
import { Icon } from "./Icon";
import {
    loadHostingAccounts,
    loadViewedFiles,
    openHostingUrl,
    persistHostingAccounts,
    persistViewedFiles,
} from "./hosting-persistence";
import { tw } from "../styles/tailwind";

interface RemoteCoordinates {
    readonly project: string;
    readonly provider?: HostingProviderKind;
    readonly baseUrl: string;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function inferRemoteCoordinates(
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

export function HostingPanel({
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
    const [provider, setProvider] = useState<HostingProviderKind>(
        coordinates?.provider ?? "gitHub",
    );
    const [baseUrl, setBaseUrl] = useState(
        coordinates?.baseUrl ?? "https://github.com",
    );
    const [token, setToken] = useState("");
    const [project, setProject] = useState(coordinates?.project ?? "");
    const [items, setItems] = useState<readonly HostingChangeRequest[]>([]);
    const [nextPage, setNextPage] = useState<number | null>(null);
    const [selected, setSelected] = useState<HostingChangeRequest>();
    const [listQuery, setListQuery] = useState("");
    const [listScope, setListScope] = useState<HostingListScope>("open");
    const [files, setFiles] = useState<readonly HostingChangedFile[]>([]);
    const [timeline, setTimeline] = useState<readonly HostingTimelineEntry[]>(
        [],
    );
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

    const selectedAccount = accounts.find(
        (account) => account.id === accountId,
    );
    const visibleItems = useMemo(
        () => filterHostingChangeRequests(items, listQuery, listScope),
        [items, listQuery, listScope],
    );

    useEffect(() => {
        if (!isNativeRuntime()) return;
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
        setItems((current) =>
            append ? [...current, ...response.items] : response.items,
        );
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
            const [
                detailResponse,
                fileResponse,
                timelineResponse,
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
                    serverViewedPromise,
                    localViewedPromise,
                ]);
            if (inspectionSequence.current !== sequence) return;
            if (detailResponse.kind === "changeRequest")
                setSelected(detailResponse.item);
            if (fileResponse.kind === "files") setFiles(fileResponse.items);
            if (timelineResponse.kind === "timeline")
                setTimeline(timelineResponse.items);
            setViewed(
                account?.provider === "gitHub" &&
                    serverViewedResponse.kind === "viewedFiles"
                    ? new Set(serverViewedResponse.paths)
                    : storedViewed,
            );
        } catch (inspectError) {
            if (inspectionSequence.current === sequence)
                setError(errorMessage(inspectError));
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
                if (!selected.nodeId)
                    throw new Error(
                        "The GitHub pull request identity is unavailable.",
                    );
                const response = await hostingBridge.execute(accountId, {
                    kind: "setViewed",
                    pullRequestId: selected.nodeId,
                    path,
                    viewed: next.has(path),
                });
                if (response.kind !== "completed")
                    throw new Error("GitHub did not update the viewed state.");
            } else {
                await persistViewedFiles(
                    accountId,
                    projectName,
                    selected.number,
                    next,
                );
            }
        } catch (persistError) {
            setViewed(viewed);
            setError(
                `Could not update viewed files: ${errorMessage(persistError)}`,
            );
        }
    };

    const connect = async (): Promise<void> => {
        if (!token.trim()) {
            setError(
                "Enter a personal access token. It will be stored in macOS Keychain.",
            );
            return;
        }
        setBusy("Verifying account");
        setError(undefined);
        try {
            const account = await hostingBridge.saveAccount(
                provider,
                baseUrl.trim(),
                token.trim(),
            );
            const next = [
                ...accounts.filter((item) => item.id !== account.id),
                account,
            ];
            setToken("");
            setAccounts(next);
            setAccountId(account.id);
            await persistHostingAccounts(next);
            setNotice(
                `Connected ${account.login}. The token is stored in macOS Keychain.`,
            );
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
        const next = adjacentHostingChangeRequest(
            visibleItems,
            selected?.number ?? null,
            direction,
        );
        if (next) void inspect(next);
    };

    if (!isNativeRuntime()) {
        return (
            <section className={tw.collectionIntro}>
                <Icon name="globe" size={18} />
                <div>
                    <strong>GitHub and GitLab require the native app</strong>
                    <p>
                        Browser preview does not expose account or credential
                        operations.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <div className={tw.hostingPanel} aria-busy={Boolean(busy)}>
            <section className={tw.hostingAccountBar}>
                <label>
                    Account
                    <select
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                    >
                        <option value="">No account</option>
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                {account.login} ·{" "}
                                {account.provider === "gitHub"
                                    ? "GitHub"
                                    : "GitLab"}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Project
                    <input
                        aria-label="Hosting project"
                        onChange={(event) => setProject(event.target.value)}
                        placeholder="owner/repository"
                        value={project}
                    />
                </label>
                <button
                    disabled={!accountId || Boolean(busy)}
                    onClick={() => void loadList()}
                >
                    <Icon name="refresh" size={13} /> Load
                </button>
                <button
                    disabled={!accountId || !project.trim()}
                    onClick={() => setShowCreate((value) => !value)}
                >
                    <Icon name="plus" size={13} /> New PR / MR
                </button>
                {selectedAccount?.provider === "gitHub" && currentBranch && (
                    <button
                        disabled={Boolean(busy) || !project.trim()}
                        onClick={() => void syncFork()}
                    >
                        <Icon name="refresh" size={13} /> Sync fork
                    </button>
                )}
            </section>

            <details className={tw.hostingConnect} open={accounts.length === 0}>
                <summary>Connect a GitHub or GitLab account</summary>
                <div className={tw.hostingFormGrid}>
                    <label>
                        Provider
                        <select
                            value={provider}
                            onChange={(event) => {
                                const next = event.target
                                    .value as HostingProviderKind;
                                setProvider(next);
                                setBaseUrl(
                                    next === "gitHub"
                                        ? "https://github.com"
                                        : "https://gitlab.com",
                                );
                            }}
                        >
                            <option value="gitHub">GitHub</option>
                            <option value="gitLab">GitLab</option>
                        </select>
                    </label>
                    <label>
                        Server URL
                        <input
                            onChange={(event) => setBaseUrl(event.target.value)}
                            value={baseUrl}
                        />
                    </label>
                    <label>
                        Personal access token
                        <input
                            autoComplete="off"
                            onChange={(event) => setToken(event.target.value)}
                            type="password"
                            value={token}
                        />
                    </label>
                    <button
                        disabled={Boolean(busy)}
                        onClick={() => void connect()}
                    >
                        {busy === "Verifying account"
                            ? "Verifying…"
                            : "Connect and store in Keychain"}
                    </button>
                </div>
                {selectedAccount && (
                    <div className={tw.hostingAccountMeta}>
                        <span>
                            {selectedAccount.login} · {selectedAccount.baseUrl}
                        </span>
                        {removeAccountId === selectedAccount.id ? (
                            <>
                                <span>
                                    Removes metadata and the Keychain
                                    credential.
                                </span>
                                <button
                                    onClick={() =>
                                        void removeAccount(selectedAccount.id)
                                    }
                                >
                                    Confirm remove
                                </button>
                                <button
                                    onClick={() =>
                                        setRemoveAccountId(undefined)
                                    }
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() =>
                                    setRemoveAccountId(selectedAccount.id)
                                }
                            >
                                Remove account
                            </button>
                        )}
                    </div>
                )}
            </details>

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
            {busy && <div className={tw.hostingProgress}>{busy}…</div>}

            {showCreate && (
                <section className={tw.hostingComposer}>
                    <strong>Create change request</strong>
                    <label>
                        Title
                        <input
                            onChange={(event) => setTitle(event.target.value)}
                            value={title}
                        />
                    </label>
                    <label>
                        Description
                        <textarea
                            onChange={(event) => setBody(event.target.value)}
                            value={body}
                        />
                    </label>
                    <div>
                        <label>
                            Source
                            <input
                                onChange={(event) =>
                                    setSourceBranch(event.target.value)
                                }
                                value={sourceBranch}
                            />
                        </label>
                        <label>
                            Target
                            <input
                                onChange={(event) =>
                                    setTargetBranch(event.target.value)
                                }
                                value={targetBranch}
                            />
                        </label>
                        <label className={tw.inlineCheck}>
                            <input
                                checked={draft}
                                onChange={(event) =>
                                    setDraft(event.target.checked)
                                }
                                type="checkbox"
                            />{" "}
                            Draft
                        </label>
                    </div>
                    <footer>
                        <button onClick={() => setShowCreate(false)}>
                            Cancel
                        </button>
                        <button
                            disabled={
                                !title.trim() ||
                                !sourceBranch.trim() ||
                                !targetBranch.trim()
                            }
                            onClick={() => void create()}
                        >
                            Create
                        </button>
                    </footer>
                </section>
            )}

            <div className={tw.hostingColumns}>
                <section
                    className={tw.hostingList}
                    aria-label="Pull and merge requests"
                    onKeyDown={navigateList}
                    tabIndex={0}
                >
                    <div className={tw.hostingListToolbar}>
                        <label>
                            <Icon name="search" size={13} />
                            <input
                                aria-label="Filter pull and merge requests"
                                onChange={(event) =>
                                    setListQuery(event.target.value)
                                }
                                placeholder="Search"
                                value={listQuery}
                            />
                        </label>
                        <select
                            aria-label="Pull and merge request state"
                            onChange={(event) =>
                                setListScope(
                                    event.target.value as HostingListScope,
                                )
                            }
                            value={listScope}
                        >
                            <option value="open">Open</option>
                            <option value="draft">Draft</option>
                            <option value="closed">Closed</option>
                            <option value="all">All</option>
                        </select>
                    </div>
                    {items.length === 0 && (
                        <p className={tw.emptyState}>
                            Load pull or merge requests for this project.
                        </p>
                    )}
                    {items.length > 0 && visibleItems.length === 0 && (
                        <p className={tw.emptyState}>
                            No pull or merge requests match the filter.
                        </p>
                    )}
                    {visibleItems.map((item) => (
                        <button
                            aria-selected={selected?.number === item.number}
                            className={
                                selected?.number === item.number
                                    ? tw.hostingSelected
                                    : undefined
                            }
                            key={item.number}
                            onClick={() => void inspect(item)}
                        >
                            <span>
                                #{item.number} · {item.state}
                                {item.draft ? " · draft" : ""}
                            </span>
                            <strong>{item.title}</strong>
                            <small>
                                {item.author} · {item.sourceBranch} →{" "}
                                {item.targetBranch}
                            </small>
                        </button>
                    ))}
                    {nextPage && (
                        <button
                            className={tw.hostingMore}
                            onClick={() => void loadList(nextPage, true)}
                        >
                            Load more
                        </button>
                    )}
                </section>

                <section
                    className={tw.hostingDetail}
                    aria-label="Change request detail"
                >
                    {!selected ? (
                        <p className={tw.emptyState}>
                            Select a change request to inspect files and
                            timeline.
                        </p>
                    ) : (
                        <>
                            <header>
                                <div>
                                    <strong>
                                        #{selected.number} {selected.title}
                                    </strong>
                                    <small>{selected.webUrl}</small>
                                </div>
                                <button
                                    onClick={() =>
                                        void navigator.clipboard.writeText(
                                            selected.webUrl,
                                        )
                                    }
                                >
                                    <Icon name="copy" size={13} /> Copy link
                                </button>
                                <button
                                    onClick={() =>
                                        void openHostingUrl(selected.webUrl)
                                    }
                                >
                                    <Icon name="external" size={13} /> Open
                                </button>
                                <button
                                    onClick={() => void updateBranch()}
                                >
                                    Update branch
                                </button>
                            </header>
                            <div className={tw.hostingReviewBar}>
                                <textarea
                                    aria-label="Review body"
                                    onChange={(event) =>
                                        setReviewBody(event.target.value)
                                    }
                                    placeholder="Review or comment"
                                    value={reviewBody}
                                />
                                <button
                                    onClick={() => void submitReview("comment")}
                                >
                                    Comment
                                </button>
                                <button
                                    onClick={() => void submitReview("approve")}
                                >
                                    Approve
                                </button>
                                <button
                                    disabled={!reviewBody.trim()}
                                    onClick={() =>
                                        void submitReview("requestChanges")
                                    }
                                >
                                    Request changes
                                </button>
                            </div>
                            <h3>Changed files · {files.length}</h3>
                            {files.map((file) => (
                                <article
                                    className={tw.hostingFile}
                                    key={file.path}
                                >
                                    <label>
                                        <input
                                            checked={viewed.has(file.path)}
                                            onChange={() =>
                                                void toggleViewed(file.path)
                                            }
                                            type="checkbox"
                                        />{" "}
                                        Viewed
                                    </label>
                                    <strong>{file.path}</strong>
                                    <small>
                                        +{file.additions} −{file.deletions} ·{" "}
                                        {file.status}
                                    </small>
                                    {file.patch && (
                                        <pre
                                            aria-label={`Diff for ${file.path}`}
                                            tabIndex={0}
                                        >
                                            <code>{file.patch}</code>
                                        </pre>
                                    )}
                                </article>
                            ))}
                            <h3>Timeline · {timeline.length}</h3>
                            {timeline.map((entry) => (
                                <article
                                    className={tw.hostingTimeline}
                                    key={entry.id}
                                >
                                    <strong>
                                        {entry.author || entry.kind}
                                    </strong>
                                    <small>{entry.createdAt}</small>
                                    <p>{entry.body}</p>
                                </article>
                            ))}
                            <div className={tw.hostingDiscussionComposer}>
                                <textarea
                                    aria-label="Add timeline comment"
                                    onChange={(event) =>
                                        setDiscussionBody(event.target.value)
                                    }
                                    placeholder="Add a comment"
                                    value={discussionBody}
                                />
                                <button
                                    disabled={!discussionBody.trim()}
                                    onClick={() => void postComment()}
                                >
                                    Comment
                                </button>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
