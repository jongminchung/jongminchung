import type {
    HostingAccount,
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
    restoreAccounts(accounts: readonly HostingAccount[]): Promise<void>;
    deleteAccount(accountId: string): Promise<void>;
    execute(
        accountId: string,
        request: HostingRequest,
    ): Promise<HostingResponse>;
}
