import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import {
    HostingAccountSchema,
    HostingOAuthPromptSchema,
    HostingResponseKindByRequest,
    HostingResponseSchema,
} from "../../src/shared/contracts/hosting";
import {
    HostingAwaitOAuthRequestSchema,
    HostingBeginOAuthRequestSchema,
    HostingCancelOAuthRequestSchema,
    HostingDeleteAccountRequestSchema,
    HostingExecuteRequestSchema,
    HostingRestoreAccountsRequestSchema,
    HostingSaveAccountRequestSchema,
} from "../../src/shared/contracts/ipc";
import { desktopTrpc } from "./main-trpc-client";

export function createHostingApi(): DesktopApi["hosting"] {
    return {
        async saveAccount(provider, baseUrl, token) {
            const request = HostingSaveAccountRequestSchema.parse({
                provider,
                baseUrl,
                token,
            });
            const account = HostingAccountSchema.parse(
                await desktopTrpc.hosting.saveAccount.mutate(request),
            );
            if (
                account.provider !== request.provider ||
                account.baseUrl !== request.baseUrl
            ) {
                throw new Error(
                    "Hosting account response did not match its request",
                );
            }
            return account;
        },
        async beginOAuth(provider, baseUrl, clientId) {
            const request = HostingBeginOAuthRequestSchema.parse({
                provider,
                baseUrl,
                clientId,
            });
            const prompt = HostingOAuthPromptSchema.parse(
                await desktopTrpc.hosting.beginOAuth.mutate(request),
            );
            if (
                prompt.provider !== request.provider ||
                prompt.baseUrl !== request.baseUrl
            ) {
                throw new Error(
                    "Hosting OAuth prompt response did not match its request",
                );
            }
            return prompt;
        },
        async awaitOAuth(sessionId) {
            const request = HostingAwaitOAuthRequestSchema.parse({ sessionId });
            return HostingAccountSchema.parse(
                await desktopTrpc.hosting.awaitOAuth.mutate(request),
            );
        },
        async cancelOAuth(sessionId): Promise<void> {
            const request = HostingCancelOAuthRequestSchema.parse({
                sessionId,
            });
            await desktopTrpc.hosting.cancelOAuth.mutate(request);
        },
        async restoreAccounts(accounts): Promise<void> {
            const request = HostingRestoreAccountsRequestSchema.parse({
                accounts,
            });
            await desktopTrpc.hosting.restoreAccounts.mutate(request);
        },
        async deleteAccount(accountId): Promise<void> {
            const request = HostingDeleteAccountRequestSchema.parse({
                accountId,
            });
            await desktopTrpc.hosting.deleteAccount.mutate(request);
        },
        async execute(accountId, untrustedRequest) {
            const request = HostingExecuteRequestSchema.parse({
                accountId,
                request: untrustedRequest,
            });
            const response = HostingResponseSchema.parse(
                await desktopTrpc.hosting.execute.mutate(request),
            );
            if (
                response.kind !==
                HostingResponseKindByRequest[request.request.kind]
            ) {
                throw new Error("Hosting response did not match its request");
            }
            return response;
        },
    };
}
