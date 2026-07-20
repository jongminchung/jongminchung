import { useEffect, useMemo, useState } from "react";
import { createHostingBridge } from "../bridge/createHostingBridge";
import type { FileChange } from "../domain/types";
import type {
  HostingAccount,
  HostingNamespace,
  HostingProviderKind,
} from "../shared/contracts/model";
import { tw } from "../styles/tailwind";
import { loadHostingAccounts } from "./hosting-persistence";
import { Icon } from "./Icon";
import { ShareInitialCommitDialog, type InitialCommitSelection } from "./ShareInitialCommitDialog";
import { Button } from "./ui";
import { CheckboxInput } from "./ui";
import { Dialog, DialogHeader } from "./ui";
import { Selector } from "./ui";
import { TextArea } from "./ui";
import { TextInput } from "./ui";

interface CreatedRepository {
  readonly project: string;
  readonly webUrl: string;
  readonly cloneUrl: string;
  readonly sshUrl: string | null;
}

export interface ShareProjectBinding {
  readonly remoteName: string;
  readonly remoteUrl: string;
  readonly webUrl: string;
  readonly initialCommit: InitialCommitSelection | null;
}

function providerLabel(provider: HostingProviderKind): string {
  return provider === "gitHub" ? "GitHub" : "GitLab";
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function namespaceKey(namespace: HostingNamespace): string {
  return namespace.id === null ? `personal:${namespace.fullPath}` : `group:${namespace.id}`;
}

export function ShareProjectDialog({
  currentBranch,
  changes,
  hasCommits,
  onBind,
  onClose,
  onManageAccounts,
  projectName,
  provider,
  remoteNames,
}: {
  readonly currentBranch: string | null;
  readonly changes: readonly FileChange[];
  readonly hasCommits: boolean;
  readonly onBind: (binding: ShareProjectBinding) => Promise<void>;
  readonly onClose: () => void;
  readonly onManageAccounts: () => void;
  readonly projectName: string;
  readonly provider: HostingProviderKind;
  readonly remoteNames: readonly string[];
}) {
  const bridge = useMemo(createHostingBridge, []);
  const service = providerLabel(provider);
  const title = provider === "gitHub" ? "Share Project On GitHub" : "Share Project on GitLab";
  const [accounts, setAccounts] = useState<readonly HostingAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [namespaces, setNamespaces] = useState<readonly HostingNamespace[]>([]);
  const [selectedNamespaceKey, setSelectedNamespaceKey] = useState("");
  const [namespaceLoading, setNamespaceLoading] = useState(false);
  const [namespaceError, setNamespaceError] = useState<string | null>(null);
  const [namespaceRefreshToken, setNamespaceRefreshToken] = useState(0);
  const [accountInformationLoading, setAccountInformationLoading] = useState(false);
  const [accountInformationError, setAccountInformationError] = useState<string | null>(null);
  const [canCreatePrivate, setCanCreatePrivate] = useState(true);
  const [ownedRepositoryNames, setOwnedRepositoryNames] = useState<readonly string[]>([]);
  const [repositoryCheckLoading, setRepositoryCheckLoading] = useState(false);
  const [repositoryCheckError, setRepositoryCheckError] = useState<string | null>(null);
  const [remoteRepositoryExists, setRemoteRepositoryExists] = useState(false);
  const [repositoryName, setRepositoryName] = useState(projectName);
  const [remoteName, setRemoteName] = useState(
    remoteNames.length === 0 ? "origin" : provider === "gitHub" ? "github" : "gitlab",
  );
  const [description, setDescription] = useState("");
  const [isPrivate, setPrivate] = useState(true);
  const [initialCommit, setInitialCommit] = useState<InitialCommitSelection | null>();
  const [initialCommitDialogOpen, setInitialCommitDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRepository | null>(null);

  useEffect(() => {
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const restored = (await loadHostingAccounts()).filter(
          (account) => account.provider === provider,
        );
        await bridge.restoreAccounts(restored);
        if (!active) return;
        setAccounts(restored);
        setAccountId(restored[0]?.id ?? "");
      } catch (reason) {
        if (active) setError(message(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, [bridge, provider]);

  useEffect(() => {
    if (provider !== "gitLab" || !accountId) {
      setNamespaces([]);
      setSelectedNamespaceKey("");
      setNamespaceError(null);
      setNamespaceLoading(false);
      return;
    }

    let active = true;
    const loadNamespaces = async (): Promise<void> => {
      setNamespaceLoading(true);
      setNamespaceError(null);
      try {
        const response = await bridge.execute(accountId, { kind: "listNamespaces" });
        if (!active) return;
        if (response.kind !== "namespaces") {
          throw new Error(`${service} did not return project namespaces.`);
        }
        setNamespaces(response.items);
        setSelectedNamespaceKey((current) =>
          response.items.some((item) => namespaceKey(item) === current)
            ? current
            : response.items[0]
              ? namespaceKey(response.items[0])
              : "",
        );
      } catch (reason) {
        if (!active) return;
        setNamespaces([]);
        setSelectedNamespaceKey("");
        setNamespaceError(`Cannot load namespaces for account: ${message(reason)}`);
      } finally {
        if (active) setNamespaceLoading(false);
      }
    };
    void loadNamespaces();
    return () => {
      active = false;
    };
  }, [accountId, bridge, namespaceRefreshToken, provider, service]);

  const selectedNamespace =
    namespaces.find((namespace) => namespaceKey(namespace) === selectedNamespaceKey) ?? null;

  useEffect(() => {
    if (provider !== "gitHub" || !accountId) {
      setAccountInformationLoading(false);
      setAccountInformationError(null);
      setCanCreatePrivate(true);
      setOwnedRepositoryNames([]);
      return;
    }
    let active = true;
    const loadAccountInformation = async (): Promise<void> => {
      setAccountInformationLoading(true);
      setAccountInformationError(null);
      try {
        const response = await bridge.execute(accountId, { kind: "listShareRepositories" });
        if (!active) return;
        if (response.kind !== "shareRepositories") {
          throw new Error("GitHub did not return repository information.");
        }
        setCanCreatePrivate(response.canCreatePrivate);
        setOwnedRepositoryNames(response.names);
      } catch (reason) {
        if (!active) return;
        setCanCreatePrivate(false);
        setOwnedRepositoryNames([]);
        setAccountInformationError(`Cannot load information for this account: ${message(reason)}`);
      } finally {
        if (active) setAccountInformationLoading(false);
      }
    };
    void loadAccountInformation();
    return () => {
      active = false;
    };
  }, [accountId, bridge, provider]);

  useEffect(() => {
    if (provider === "gitHub") {
      setRemoteRepositoryExists(ownedRepositoryNames.includes(repositoryName));
    }
  }, [ownedRepositoryNames, provider, repositoryName]);

  useEffect(() => {
    if (
      provider !== "gitLab" ||
      !accountId ||
      selectedNamespace === null ||
      !/^[A-Za-z0-9_.-]+$/u.test(repositoryName)
    ) {
      setRepositoryCheckLoading(false);
      setRepositoryCheckError(null);
      if (provider === "gitLab") setRemoteRepositoryExists(false);
      return;
    }

    let active = true;
    setRemoteRepositoryExists(false);
    setRepositoryCheckError(null);
    const timer = window.setTimeout(() => {
      const checkRepository = async (): Promise<void> => {
        setRepositoryCheckLoading(true);
        setRepositoryCheckError(null);
        try {
          const response = await bridge.execute(accountId, {
            kind: "checkShareRepository",
            namespacePath: selectedNamespace.fullPath,
            name: repositoryName,
          });
          if (!active) return;
          if (response.kind !== "repositoryAvailability") {
            throw new Error("GitLab did not return repository availability.");
          }
          setRemoteRepositoryExists(response.exists);
        } catch (reason) {
          if (!active) return;
          setRemoteRepositoryExists(false);
          setRepositoryCheckError(`Cannot check repository availability: ${message(reason)}`);
        } finally {
          if (active) setRepositoryCheckLoading(false);
        }
      };
      void checkRepository();
    }, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accountId, bridge, provider, repositoryName, selectedNamespace]);

  const validation = (): string | null => {
    if (!accountId) return `Add or select a ${service} account.`;
    if (accountInformationError) return accountInformationError;
    if (provider === "gitLab" && namespaceError) return namespaceError;
    if (provider === "gitLab" && selectedNamespace === null) return "No namespace selected.";
    if (!/^[A-Za-z0-9_.-]+$/u.test(repositoryName)) {
      return "Repository name can contain letters, numbers, dots, hyphens, and underscores.";
    }
    if (repositoryCheckError) return repositoryCheckError;
    if (remoteRepositoryExists) return "Repository with selected name already exists.";
    if (!remoteName.trim()) return "Enter a remote name.";
    if (created === null && remoteNames.includes(remoteName.trim())) {
      return `Remote '${remoteName.trim()}' already exists.`;
    }
    if (hasCommits && !currentBranch) {
      return "Check out a local branch before sharing this project.";
    }
    return null;
  };

  const completeLocalSetup = async (
    repository: CreatedRepository,
    selection: InitialCommitSelection | null,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    setInitialCommitDialogOpen(false);
    try {
      await onBind({
        remoteName: remoteName.trim(),
        remoteUrl: repository.cloneUrl,
        webUrl: repository.webUrl,
        initialCommit: selection,
      });
      onClose();
    } catch (reason) {
      setError(`The remote repository was created, but local setup failed: ${message(reason)}`);
    } finally {
      setBusy(false);
    }
  };

  const share = async (): Promise<void> => {
    const invalid = validation();
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let repository = created;
      if (repository === null) {
        const response = await bridge.execute(accountId, {
          kind: "shareRepository",
          name: repositoryName.trim(),
          description,
          private: isPrivate,
          namespaceId: provider === "gitLab" ? (selectedNamespace?.id ?? null) : null,
        });
        if (response.kind !== "repository") {
          throw new Error(`${service} did not return the created repository.`);
        }
        repository = response;
        setCreated(response);
      }
      if (!hasCommits && initialCommit === undefined) {
        setInitialCommitDialogOpen(true);
        return;
      }
      await completeLocalSetup(repository, initialCommit ?? null);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };

  if (initialCommitDialogOpen && created !== null) {
    return (
      <ShareInitialCommitDialog
        files={changes}
        onAdd={(selection) => {
          setInitialCommit(selection);
          void completeLocalSetup(created, selection);
        }}
        onCancel={() => {
          setInitialCommit(null);
          void completeLocalSetup(created, null);
        }}
      />
    );
  }

  return (
    <Dialog
      aria-label={title}
      isOpen
      maxHeight="min(720px, calc(100vh - 70px))"
      onOpenChange={(open) => !open && onClose()}
      padding={0}
      purpose="form"
      width={530}
    >
      <section className={tw.shareProjectDialog}>
        <DialogHeader hasDivider onOpenChange={(open) => !open && onClose()} title={title} />
        <main>
          {provider === "gitLab" && (
            <div className={tw.shareProjectAccount}>
              <Selector
                isDisabled={loading || busy || created !== null}
                label="Account"
                onChange={setAccountId}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: `${new URL(account.baseUrl).host} - ${account.login}`,
                }))}
                placeholder="No accounts"
                value={accountId}
                width="100%"
              />
              <Button label="Add account" onClick={onManageAccounts} variant="secondary" />
            </div>
          )}
          {provider === "gitLab" && (
            <div className={tw.shareProjectAccount}>
              <Selector
                hasSearch
                isDisabled={busy || created !== null || !accountId}
                isLoading={namespaceLoading}
                label="Namespace / Group"
                labelTooltip="Missing a subgroup? Subgroups can currently only be fetched from GitLab servers of version 17.10 and higher."
                onChange={setSelectedNamespaceKey}
                options={namespaces.map((namespace) => ({
                  value: namespaceKey(namespace),
                  label: namespace.personal
                    ? `Personal: ${namespace.fullName}`
                    : namespace.fullName,
                }))}
                placeholder="No namespaces loaded"
                status={
                  namespaceError === null ? undefined : { type: "error", message: namespaceError }
                }
                value={selectedNamespaceKey}
                width="100%"
              />
              <Button
                icon={<Icon name="refresh" size={14} />}
                isDisabled={namespaceLoading || busy || created !== null || !accountId}
                isIconOnly
                label="Refresh namespaces"
                onClick={() => setNamespaceRefreshToken((value) => value + 1)}
                tooltip="Refresh namespaces"
                variant="secondary"
              />
            </div>
          )}
          <div className={tw.shareProjectCoordinates}>
            <TextInput
              hasAutoFocus
              isDisabled={busy || created !== null}
              isLoading={accountInformationLoading || repositoryCheckLoading}
              label="Repository name"
              onChange={setRepositoryName}
              status={
                remoteRepositoryExists
                  ? { type: "error", message: "Repository with selected name already exists." }
                  : repositoryCheckError === null
                    ? undefined
                    : { type: "error", message: repositoryCheckError }
              }
              value={repositoryName}
              width="100%"
            />
            <CheckboxInput
              disabledMessage={
                !canCreatePrivate ? "Your account doesn't support private repositories." : undefined
              }
              isDisabled={busy || created !== null || !canCreatePrivate}
              label="Private"
              onChange={setPrivate}
              value={isPrivate}
            />
          </div>
          <TextInput
            isDisabled={busy || created !== null}
            label="Remote name"
            onChange={setRemoteName}
            value={remoteName}
            width="100%"
          />
          {provider === "gitHub" ? (
            <TextArea
              isDisabled={busy || created !== null}
              label="Description"
              onChange={setDescription}
              rows={4}
              value={description}
              width="100%"
            />
          ) : (
            <TextInput
              isDisabled={busy || created !== null}
              label="Description"
              onChange={setDescription}
              value={description}
              width="100%"
            />
          )}
          {provider === "gitHub" && !loading && accounts.length !== 1 && (
            <div className={tw.shareProjectAccount}>
              <Selector
                isDisabled={busy || created !== null}
                label="Share by"
                onChange={setAccountId}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: `${new URL(account.baseUrl).host} - ${account.login}`,
                }))}
                placeholder="No accounts"
                value={accountId}
                width="100%"
              />
              {accounts.length === 0 && (
                <Button label="Add account" onClick={onManageAccounts} variant="secondary" />
              )}
            </div>
          )}
          {created && (
            <p role="status">
              Remote repository created at <code>{created.project}</code>. Retrying will only finish
              local Git setup.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </main>
        <footer>
          <Button label="Cancel" onClick={onClose} variant="secondary" />
          <Button
            isDisabled={
              loading ||
              namespaceLoading ||
              accountInformationLoading ||
              repositoryCheckLoading ||
              busy ||
              accounts.length === 0 ||
              (provider === "gitLab" && selectedNamespace === null) ||
              accountInformationError !== null ||
              repositoryCheckError !== null ||
              remoteRepositoryExists
            }
            label={busy ? "Sharing…" : created ? "Retry Local Setup" : "Share"}
            onClick={() => void share()}
            variant="primary"
          />
        </footer>
      </section>
    </Dialog>
  );
}
