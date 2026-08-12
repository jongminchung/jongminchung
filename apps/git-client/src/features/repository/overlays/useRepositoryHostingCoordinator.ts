import { useCallback } from "react";
import { openExternalUrl } from "../../../application/desktop/DesktopPort";
import { loadHostingAccounts } from "../../../components/hosting-persistence";
import type { ProductNotification } from "../../../components/NotificationToolWindow";
import type { ShareProjectBinding } from "../../../components/ShareProjectDialog";
import type { RepositoryView } from "../../../domain/types";
import type {
    GitOperation,
    RemoteInfo,
} from "../../../shared/contracts/model/index";
import type { RepositoryWorkspaceStore } from "../state/repositoryWorkspaceStore";

function remoteHostname(remote: string): string | null {
    try {
        return new URL(remote).hostname.toLowerCase();
    } catch {
        const match = /^(?:[^@\s]+@)?([^:/\s]+):[^\s]+$/u.exec(remote);
        return match?.[1]?.toLowerCase() ?? null;
    }
}

function remoteBrowserUrl(remote: string): string | null {
    try {
        const url = new URL(remote);
        if (url.protocol === "https:" || url.protocol === "http:") {
            url.username = "";
            url.password = "";
            url.pathname = url.pathname.replace(/\.git$/u, "");
            url.search = "";
            url.hash = "";
            return url.toString();
        }
        if (url.protocol === "ssh:") {
            return `https://${url.hostname}${url.pathname.replace(/\.git$/u, "")}`;
        }
    } catch {
        const match = /^(?:[^@\s]+@)?([^:/\s]+):(.+)$/u.exec(remote);
        if (match?.[1] && match[2])
            return `https://${match[1]}/${match[2].replace(/\.git$/u, "")}`;
    }
    return null;
}

interface RepositoryHostingCoordinatorOptions {
    readonly executeOperation: (
        operation: GitOperation,
        throwOnError?: boolean,
    ) => Promise<void>;
    readonly onNotification: (notification: ProductNotification) => void;
    readonly onToast: (message: string) => void;
    readonly remotes: readonly RemoteInfo[];
    readonly repository: RepositoryView;
    readonly shareProjectProvider: "gitHub" | "gitLab" | undefined;
    readonly setBalloonId: RepositoryWorkspaceStore["setBalloonId"];
    readonly setShareExistingRemotes: RepositoryWorkspaceStore["setShareExistingRemotes"];
    readonly setShareProjectProvider: RepositoryWorkspaceStore["setShareProjectProvider"];
}

export function useRepositoryHostingCoordinator({
    executeOperation,
    onNotification,
    onToast,
    remotes,
    repository,
    shareProjectProvider,
    setBalloonId,
    setShareExistingRemotes,
    setShareProjectProvider,
}: RepositoryHostingCoordinatorOptions) {
    const requestShareProject = useCallback(
        async (provider: "gitHub" | "gitLab"): Promise<void> => {
            const accounts = await loadHostingAccounts().catch(() => []);
            const knownHosts = new Set([
                provider === "gitHub" ? "github.com" : "gitlab.com",
                ...accounts
                    .filter((account) => account.provider === provider)
                    .map((account) =>
                        new URL(account.baseUrl).hostname.toLowerCase(),
                    ),
            ]);
            const matchingRemotes = [
                ...new Set(
                    remotes
                        .flatMap((remote) => [remote.fetchUrl, remote.pushUrl])
                        .filter((remote) => {
                            const hostname = remoteHostname(remote);
                            return (
                                hostname !== null && knownHosts.has(hostname)
                            );
                        }),
                ),
            ];
            if (matchingRemotes.length > 0) {
                setShareExistingRemotes({ provider, remotes: matchingRemotes });
                return;
            }
            setShareProjectProvider(provider);
        },
        [remotes, setShareExistingRemotes, setShareProjectProvider],
    );

    const openExistingRemote = useCallback(
        (remote: string): void => {
            const url = remoteBrowserUrl(remote);
            if (url === null) {
                onToast("This remote URL cannot be opened in a browser.");
                return;
            }
            void openExternalUrl(url);
        },
        [onToast],
    );

    const bindSharedProject = useCallback(
        async (binding: ShareProjectBinding): Promise<void> => {
            const existingRemote = remotes.find(
                (remote) => remote.name === binding.remoteName,
            );
            if (!existingRemote) {
                await executeOperation(
                    {
                        kind: "remoteAdd",
                        name: binding.remoteName,
                        url: binding.remoteUrl,
                    },
                    true,
                );
            } else if (
                existingRemote.fetchUrl !== binding.remoteUrl &&
                existingRemote.pushUrl !== binding.remoteUrl
            ) {
                throw new Error(
                    `Remote '${binding.remoteName}' now points to a different repository.`,
                );
            }
            if (binding.initialCommit && !repository.snapshot.hasCommits) {
                const selectedPaths = new Set(binding.initialCommit.paths);
                const excludedStagedPaths = repository.status.changes
                    .filter(
                        (change) =>
                            change.staged && !selectedPaths.has(change.path),
                    )
                    .map((change) => change.path);
                if (excludedStagedPaths.length > 0) {
                    await executeOperation(
                        { kind: "removeCached", paths: excludedStagedPaths },
                        true,
                    );
                }
                await executeOperation(
                    { kind: "stage", paths: [...binding.initialCommit.paths] },
                    true,
                );
                await executeOperation(
                    {
                        kind: "commitAdvanced",
                        message: binding.initialCommit.message,
                        amend: false,
                        signOff: false,
                        gpgSign: false,
                        skipHooks: false,
                        commitAll: false,
                    },
                    true,
                );
            }
            if (
                repository.snapshot.hasCommits ||
                binding.initialCommit !== null
            ) {
                const branch = repository.snapshot.currentBranch;
                if (!branch)
                    throw new Error(
                        "Check out a local branch before pushing the shared project.",
                    );
                await executeOperation(
                    {
                        kind: "push",
                        destination: {
                            remote: binding.remoteName,
                            remoteRef: `refs/heads/${branch}`,
                            localRevision: branch,
                            setUpstream: true,
                        },
                        mode: { kind: "normal" },
                    },
                    true,
                );
            }
            const service =
                shareProjectProvider === "gitHub" ? "GitHub" : "GitLab";
            const createdEmptyRepository =
                !repository.snapshot.hasCommits &&
                binding.initialCommit === null;
            const title = createdEmptyRepository
                ? `Successfully created empty repository on ${service}`
                : `Successfully shared on ${service}`;
            onToast(
                createdEmptyRepository ? title : `Project shared on ${service}`,
            );
            const notification: ProductNotification = {
                id: crypto.randomUUID(),
                title,
                message: binding.webUrl,
                kind: "success",
                createdAt: Date.now(),
                actions: ["openUrl"],
                url: binding.webUrl,
            };
            onNotification(notification);
            setBalloonId(notification.id);
        },
        [
            executeOperation,
            onNotification,
            onToast,
            remotes,
            repository,
            setBalloonId,
            shareProjectProvider,
        ],
    );

    return { bindSharedProject, openExistingRemote, requestShareProject };
}
