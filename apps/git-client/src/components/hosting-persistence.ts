import {
    HostingAccountSchema,
    HostingAccountsSchema,
} from "../../electron/hosting/hosting-contract";
import type { HostingAccount } from "../generated";
import { electronApi } from "../platform/electron";
import type { JsonValue } from "../shared/contracts/ipc";

const HOSTING_ACCOUNTS_KEY = "hostingAccounts";

async function readSetting(key: string): Promise<unknown> {
    const api = electronApi();
    if (api !== null) return api.settings.get(key);
    throw new Error("Electron settings are unavailable");
}

async function writeSetting(key: string, value: JsonValue): Promise<void> {
    const api = electronApi();
    if (api !== null) {
        await api.settings.set(key, value);
        return;
    }
    throw new Error("Electron settings are unavailable");
}

function accountJson(accounts: readonly HostingAccount[]): JsonValue {
    return HostingAccountsSchema.parse(accounts).map((account) => ({
        id: account.id,
        provider: account.provider,
        baseUrl: account.baseUrl,
        login: account.login,
    }));
}

export async function loadHostingAccounts(): Promise<
    readonly HostingAccount[]
> {
    const stored = await readSetting(HOSTING_ACCOUNTS_KEY);
    if (!Array.isArray(stored)) return [];
    const accounts = stored.flatMap((candidate) => {
        const result = HostingAccountSchema.safeParse(candidate);
        return result.success ? [{ ...result.data }] : [];
    });
    return HostingAccountsSchema.parse(accounts.slice(0, 1_000));
}

export async function persistHostingAccounts(
    accounts: readonly HostingAccount[],
): Promise<void> {
    await writeSetting(HOSTING_ACCOUNTS_KEY, accountJson(accounts));
}

export function viewedFilesKey(
    accountId: string,
    project: string,
    number: number,
): string {
    return `hostingViewedFiles:${encodeURIComponent(accountId)}:${encodeURIComponent(project)}:${number}`;
}

export async function loadViewedFiles(
    accountId: string,
    project: string,
    number: number,
): Promise<ReadonlySet<string>> {
    const stored = await readSetting(
        viewedFilesKey(accountId, project, number),
    );
    return new Set(
        Array.isArray(stored)
            ? stored.filter((path): path is string => typeof path === "string")
            : [],
    );
}

export async function persistViewedFiles(
    accountId: string,
    project: string,
    number: number,
    paths: ReadonlySet<string>,
): Promise<void> {
    await writeSetting(
        viewedFilesKey(accountId, project, number),
        [...paths].sort(),
    );
}

export async function openHostingUrl(url: string): Promise<void> {
    const api = electronApi();
    if (api !== null) {
        await api.shell.openExternal(url);
        return;
    }
    throw new Error("Electron URL opening is unavailable");
}
