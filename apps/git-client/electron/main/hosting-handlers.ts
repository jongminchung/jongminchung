import type { MainDesktopTrpcRouter } from "../../src/shared/contracts/desktop-trpc";
import {
    HostingDeleteAccountRequestSchema,
    HostingExecuteRequestSchema,
    HostingRestoreAccountsRequestSchema,
    HostingSaveAccountRequestSchema,
} from "../../src/shared/contracts/ipc";
import {
    HostingAccountSchema,
    HostingResponseKindByRequest,
    HostingResponseSchema,
    type ElectronHostingFoundation,
} from "../hosting";
import { safeHostingErrorMessage } from "../hosting/hosting-redaction";
import type { DesktopTrpcHost } from "./desktop-trpc-host";

interface HostingHandlerDependencies {
    readonly router: DesktopTrpcHost<MainDesktopTrpcRouter>;
    readonly hosting: ElectronHostingFoundation;
}

function hostingToken(raw: unknown): string | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
        return null;
    const token = Reflect.get(raw, "token");
    return typeof token === "string" && token.length <= 16_384 ? token : null;
}

function hostingIpcError(
    error: unknown,
    secrets: readonly string[] = [],
): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(safeHostingErrorMessage(message, secrets));
}

export function registerHostingHandlers({
    router,
    hosting,
}: HostingHandlerDependencies): void {
    router.handle("hosting", "saveAccount", async (_event, raw) => {
        const token = hostingToken(raw);
        try {
            const request = HostingSaveAccountRequestSchema.parse(raw);
            return HostingAccountSchema.parse(
                await hosting.saveAccount(
                    request.provider,
                    request.baseUrl,
                    request.token,
                ),
            );
        } catch (error) {
            throw hostingIpcError(error, token === null ? [] : [token]);
        }
    });
    router.handle("hosting", "restoreAccounts", (_event, raw): void => {
        try {
            const request = HostingRestoreAccountsRequestSchema.parse(raw);
            hosting.restoreAccounts(request.accounts);
        } catch (error) {
            throw hostingIpcError(error);
        }
    });
    router.handle(
        "hosting",
        "deleteAccount",
        async (_event, raw): Promise<void> => {
            try {
                const request = HostingDeleteAccountRequestSchema.parse(raw);
                await hosting.deleteAccount(request.accountId);
            } catch (error) {
                throw hostingIpcError(error);
            }
        },
    );
    router.handle("hosting", "execute", async (_event, raw) => {
        try {
            const request = HostingExecuteRequestSchema.parse(raw);
            const response = HostingResponseSchema.parse(
                await hosting.execute(request.accountId, request.request),
            );
            if (
                response.kind !==
                HostingResponseKindByRequest[request.request.kind]
            ) {
                throw new Error("Hosting response did not match its request");
            }
            return response;
        } catch (error) {
            throw hostingIpcError(error);
        }
    });
}
