import { useCallback } from "react";
import { loadHostingAccounts } from "../../components/hosting-persistence";
import type { RemoteInfo } from "../../shared/contracts/model";
import type { RepositoryWorkspaceStore } from "../state/repositoryWorkspaceStore";

function remoteHostname(remote: string): string | null {
  try {
    return new URL(remote).hostname.toLowerCase();
  } catch {
    const match = /^(?:[^@\s]+@)?([^:/\s]+):[^\s]+$/u.exec(remote);
    return match?.[1]?.toLowerCase() ?? null;
  }
}

interface RepositoryHostingCoordinatorOptions {
  readonly remotes: readonly RemoteInfo[];
  readonly setShareExistingRemotes: RepositoryWorkspaceStore["setShareExistingRemotes"];
  readonly setShareProjectProvider: RepositoryWorkspaceStore["setShareProjectProvider"];
}

export function useRepositoryHostingCoordinator({
  remotes,
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
          .map((account) => new URL(account.baseUrl).hostname.toLowerCase()),
      ]);
      const matchingRemotes = [
        ...new Set(
          remotes
            .flatMap((remote) => [remote.fetchUrl, remote.pushUrl])
            .filter((remote) => {
              const hostname = remoteHostname(remote);
              return hostname !== null && knownHosts.has(hostname);
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

  return { requestShareProject };
}
