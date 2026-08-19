import { Button } from "@jongminchung/ui/components/button";
import { Input } from "@jongminchung/ui/components/input";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import type {
    HostingAccount,
    HostingProviderKind,
} from "../../shared/contracts/model/index";
import { Selector } from "../ProductFormControls";

interface HostingAccountConnectionProps {
    readonly accountId: string;
    readonly accounts: readonly HostingAccount[];
    readonly busy?: string;
    readonly initialBaseUrl: string;
    readonly initialProvider: HostingProviderKind;
    readonly onConnect: (
        provider: HostingProviderKind,
        baseUrl: string,
        token: string,
    ) => Promise<boolean>;
    readonly onRemove: (accountId: string) => Promise<boolean>;
}

export function HostingAccountConnection({
    accountId,
    accounts,
    busy,
    initialBaseUrl,
    initialProvider,
    onConnect,
    onRemove,
}: HostingAccountConnectionProps) {
    const [provider, setProvider] =
        useState<HostingProviderKind>(initialProvider);
    const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
    const [token, setToken] = useState("");
    const [removeAccountId, setRemoveAccountId] = useState<string>();
    const selectedAccount = accounts.find(
        (account) => account.id === accountId,
    );
    const tokenGuidance =
        provider === "gitHub"
            ? "Use a fine-grained token with access only to the repositories you need. Pull requests: read/write and Contents: read/write are required for the full Hosting workflow."
            : "Use a project or personal access token with api scope. Limit project membership and token expiry to the repositories you need.";

    const connect = async (): Promise<void> => {
        if (await onConnect(provider, baseUrl.trim(), token.trim()))
            setToken("");
    };
    const remove = async (id: string): Promise<void> => {
        if (await onRemove(id)) setRemoveAccountId(undefined);
    };

    return (
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
                        setBaseUrl(
                            next === "gitHub"
                                ? "https://github.com"
                                : "https://gitlab.com",
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
                        onChange={(event) => setBaseUrl(event.target.value)}
                        value={baseUrl}
                    />
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
                    {busy === "Verifying account"
                        ? "Verifying…"
                        : "Connect and store in Keychain"}
                </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground" role="note">
                {tokenGuidance} The credential is used only for Hosting API
                actions; Git push credentials are managed separately. Browser
                sign-in is unavailable until a provider OAuth application and
                redirect policy are configured, so personal access tokens remain
                the supported fallback for cloud and self-hosted servers.
            </p>
            {selectedAccount && (
                <div
                    className={`hostingAccountMeta [align-items:center] [display:flex] [gap:8px] [border-top:1px_solid_var(--border)] [color:var(--muted-foreground)] [margin-top:9px] [padding-top:8px] [&>_span:first-child]:[flex:1] hostingAccountMeta`}
                >
                    <span>
                        {selectedAccount.login} · {selectedAccount.baseUrl}
                    </span>
                    {removeAccountId === selectedAccount.id ? (
                        <>
                            <span>
                                Removes metadata and the Keychain credential.
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
                            onClick={() =>
                                setRemoveAccountId(selectedAccount.id)
                            }
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
