import type {
    HostingAccount,
    HostingOAuthPrompt,
    HostingProviderKind,
    HostingRequest,
    HostingResponse,
} from "../shared/contracts/model/index";

export interface HostingBridge {
    saveAccount(
        provider: HostingProviderKind,
        baseUrl: string,
        token: string,
    ): Promise<HostingAccount>;
    beginOAuth(
        provider: HostingProviderKind,
        baseUrl: string,
        clientId: string,
    ): Promise<HostingOAuthPrompt>;
    awaitOAuth(sessionId: string): Promise<HostingAccount>;
    cancelOAuth(sessionId: string): Promise<void>;
    restoreAccounts(accounts: readonly HostingAccount[]): Promise<void>;
    deleteAccount(accountId: string): Promise<void>;
    execute(
        accountId: string,
        request: HostingRequest,
    ): Promise<HostingResponse>;
}
