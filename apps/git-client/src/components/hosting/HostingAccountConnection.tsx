import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import type {
  HostingAccount,
  HostingOAuthPrompt,
  HostingProviderKind,
} from "../../shared/contracts/model/index";
import { Selector } from "../ProductFormControls";

interface HostingAccountConnectionProps {
  readonly accountId: string;
  readonly accounts: readonly HostingAccount[];
  readonly busy?: string;
  readonly initialBaseUrl: string;
  readonly initialProvider: HostingProviderKind;
  readonly oauthPrompt?: HostingOAuthPrompt;
  readonly onConnect: (
    provider: HostingProviderKind,
    baseUrl: string,
    token: string,
  ) => Promise<boolean>;
  readonly onOAuthCancel: () => Promise<void>;
  readonly onOAuthConnect: (
    provider: HostingProviderKind,
    baseUrl: string,
    clientId: string,
  ) => Promise<boolean>;
  readonly onRemove: (accountId: string) => Promise<boolean>;
}

export function HostingAccountConnection({
  accountId,
  accounts,
  busy,
  initialBaseUrl,
  initialProvider,
  oauthPrompt,
  onConnect,
  onOAuthCancel,
  onOAuthConnect,
  onRemove,
}: HostingAccountConnectionProps) {
  const [provider, setProvider] =
    useState<HostingProviderKind>(initialProvider);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [clientId, setClientId] = useState("");
  const [token, setToken] = useState("");
  const [removeAccountId, setRemoveAccountId] = useState<string>();
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const tokenGuidance =
    provider === "gitHub"
      ? "Use a fine-grained token with access only to the repositories you need. Pull requests: read/write and Contents: read/write are required for the full Hosting workflow."
      : "Use a project or personal access token with api scope. Limit project membership and token expiry to the repositories you need.";
  const providerName = provider === "gitHub" ? "GitHub" : "GitLab";
  const oauthGuidance =
    provider === "gitHub"
      ? "The GitHub App must have device flow enabled and be installed for the repositories you select. It requests Pull requests and Contents read/write access."
      : "The non-confidential GitLab OAuth app must register http://127.0.0.1:53682/oauth/callback and allow api scope.";

  const connect = async (): Promise<void> => {
    if (await onConnect(provider, baseUrl.trim(), token.trim())) setToken("");
  };
  const connectOAuth = async (): Promise<void> => {
    await onOAuthConnect(provider, baseUrl.trim(), clientId.trim());
  };
  const remove = async (id: string): Promise<void> => {
    if (await onRemove(id)) setRemoveAccountId(undefined);
  };

  return (
    <details
      className={`hostingConnect hostingConnect [padding:8px_11px] [border-bottom:1px_solid_var(--border)] [&_summary]:[cursor:default] [&_summary]:[font-weight:600] [&_summary]:[color:var(--muted-foreground)]`}
      open={accounts.length === 0}
    >
      <summary>Connect a GitHub or GitLab account</summary>
      <div
        className={`hostingFormGrid hostingFormGrid [display:grid] [grid-template-columns:110px_minmax(190px,_1fr)_minmax(190px,_1fr)_auto] [align-items:end] [gap:8px] [padding-top:9px] [&_label]:[display:flex] [&_label]:[flex-direction:column] [&_label]:[gap:3px] [&_label]:[font-size:11px] [&_label]:[color:var(--muted-foreground)]`}
      >
        <Selector
          className="bg-secondary"
          isDisabled={Boolean(busy)}
          label="Provider"
          value={provider}
          onChange={(value) => {
            const next = value as HostingProviderKind;
            setProvider(next);
            setBaseUrl(
              next === "gitHub" ? "https://github.com" : "https://gitlab.com",
            );
          }}
          options={[
            { label: "GitHub", value: "gitHub" },
            { label: "GitLab", value: "gitLab" },
          ]}
        />
        <label>
          Server URL
          <Input
            disabled={Boolean(busy)}
            onChange={(event) => setBaseUrl(event.target.value)}
            value={baseUrl}
          />
        </label>
        <label>
          OAuth app client ID
          <Input
            autoComplete="off"
            disabled={Boolean(busy)}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Optional for cloud providers"
            value={clientId}
          />
        </label>
        <Button
          disabled={Boolean(busy)}
          onClick={() => void connectOAuth()}
          type="button"
          className={cn("h-7 px-2.5")}
          variant="outline"
          size="sm"
        >
          {busy === "Starting browser sign-in"
            ? "Starting…"
            : busy === "Waiting for browser sign-in"
              ? "Waiting…"
              : `Sign in with ${providerName}`}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground" role="note">
        Leave the client ID blank to use the packaged cloud provider
        configuration. Self-hosted servers require their own OAuth app client
        ID. {oauthGuidance} Git push credentials are managed separately.
      </p>
      {oauthPrompt && (
        <div
          className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground"
          role="status"
        >
          <span className="flex-1">
            Browser sign-in opened for {providerName}
            {oauthPrompt.userCode ? (
              <>
                {" "}
                with one-time code{" "}
                <code className="font-semibold text-foreground">
                  {oauthPrompt.userCode}
                </code>
              </>
            ) : null}
            . Complete authorization before{" "}
            <time dateTime={new Date(oauthPrompt.expiresAt).toISOString()}>
              {new Date(oauthPrompt.expiresAt).toLocaleTimeString()}
            </time>
            .
          </span>
          <Button
            onClick={() => void onOAuthCancel()}
            type="button"
            className={cn("h-7 px-2.5")}
            variant="outline"
            size="sm"
          >
            Cancel sign-in
          </Button>
        </div>
      )}
      <details className="mt-2 border-t border-border pt-2">
        <summary className="cursor-default text-[11px] font-semibold text-muted-foreground">
          Use a personal access token instead
        </summary>
        <div className="mt-2 flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
            Personal access token
            <Input
              autoComplete="off"
              disabled={Boolean(busy)}
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
            {busy === "Verifying account"
              ? "Verifying…"
              : "Connect and store in Keychain"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground" role="note">
          {tokenGuidance} The credential is used only for Hosting API actions.
          PAT connection remains available for cloud and self-hosted servers.
        </p>
      </details>
      {selectedAccount && (
        <div
          className={`hostingAccountMeta hostingAccountMeta [margin-top:9px] [display:flex] [align-items:center] [gap:8px] [padding-top:8px] [color:var(--muted-foreground)] [border-top:1px_solid_var(--border)] [&>_span:first-child]:[flex:1]`}
        >
          <span>
            {selectedAccount.login} · {selectedAccount.baseUrl} ·{" "}
            {selectedAccount.authentication === "oauth" ? "OAuth" : "PAT"}
          </span>
          {removeAccountId === selectedAccount.id ? (
            <>
              <span>
                Removes local metadata and the Keychain credential. Provider
                authorization is not revoked.
              </span>
              <Button
                onClick={() => void remove(selectedAccount.id)}
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
              title="Removes local credentials only; Provider authorization is not revoked"
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
  );
}
