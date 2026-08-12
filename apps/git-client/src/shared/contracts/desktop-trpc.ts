import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
    HostingAccountSchema,
    HostingResponseSchema,
} from "../../../electron/hosting/hosting-contract";
import {
    type DesktopTrpcAuthorization,
    type DesktopTrpcCapability,
    type DesktopTrpcDomain,
    type DesktopTrpcOperationType,
} from "./desktop-trpc-wire";
import {
    FileContentSchema,
    FilePreviewSchema,
    GitCloneRepositoryRequestSchema,
    GitCreationCancelledEventSchema,
    GitCreationCompletedEventSchema,
    GitCreationFailedEventSchema,
    GitExecutionRequestSchema,
    GitInitializeRepositoryRequestSchema,
    GitReadFileRequestSchema,
    GitRepositoryServiceRequestSchema,
    GitRepositoryServiceResultSchema,
    GitWatchRepositoryRequestSchema,
    GitWorkingTreeFileRequestSchema,
    GitWriteWorkingTreeFileRequestSchema,
    OpenRepositoryRequestSchema,
    RepositoryRecordSchema,
    RepositorySnapshotSchema,
} from "./git-utility";
import {
    ClipboardTextSchema,
    ClipboardWriteRequestSchema,
    CommandLineLauncherInfoSchema,
    DialogRequestSchema,
    DialogSelectionSchema,
    DiagnosticConfigurationKindSchema,
    DiagnosticConfigurationWriteRequestSchema,
    DiagnosticDeleteLeftoverDirectoriesRequestSchema,
    DiagnosticDeletedLeftoverDirectoryIdsSchema,
    DiagnosticLeftoverDirectoriesSchema,
    DiagnosticPathKindSchema,
    DiagnosticSnapshotSchema,
    ExternalUrlSchema,
    GitCancelQueryRequestSchema,
    GitCloseRepositoryRequestSchema,
    GitRepositoryRequestSchema,
    GitTerminalResultSchema,
    HostingDeleteAccountRequestSchema,
    HostingExecuteRequestSchema,
    HostingRestoreAccountsRequestSchema,
    HostingSaveAccountRequestSchema,
    HtmlExportRequestSchema,
    JsonValueSchema,
    MaintenanceRelaunchRequestSchema,
    NativeCommandStatesSchema,
    OfflineInspectionFilesSchema,
    PatchTextExportRequestSchema,
    RuntimeInfoSchema,
    SettingsDeleteRequestSchema,
    SettingsGetRequestSchema,
    SettingsSetRequestSchema,
    WindowPresentationModeSchema,
} from "./ipc";
import { LocalHistoryRepositoryRequestSchema } from "./local-history-ipc";
export {
    DESKTOP_TRPC_CHANNELS,
    DESKTOP_TRPC_PROTOCOL_VERSION,
    DesktopTrpcRequestSchema,
    DesktopTrpcResponseSchema,
    type DesktopTrpcAuthorization,
    type DesktopTrpcCapability,
    type DesktopTrpcDomain,
    type DesktopTrpcOperationType,
    type DesktopTrpcResponse,
    type MainDesktopTrpcDomain,
} from "./desktop-trpc-wire";
import {
    TerminalCloseRepositoryRequestSchema,
    TerminalCloseRequestSchema,
    TerminalCreateRequestSchema,
    TerminalCreateResultSchema,
    TerminalLaunchTargetsSchema,
    TerminalListLaunchTargetsRequestSchema,
    TerminalResizeRequestSchema,
    TerminalWriteRequestSchema,
} from "./terminal";

interface DesktopTrpcContext {
    readonly authorize: (
        authorization: DesktopTrpcAuthorization,
        domain: DesktopTrpcDomain,
        procedure: string,
        input: unknown,
    ) => void | Promise<void>;
    readonly invoke: (
        domain: DesktopTrpcDomain,
        procedure: string,
        input: unknown,
    ) => unknown;
}

const t = initTRPC.context<DesktopTrpcContext>().create();
const VoidSchema = z.void();
const BooleanSchema = z.boolean();
const DiagnosticConfigurationTextSchema = z.string().max(1_048_576);
const DiagnosticPathResultSchema = z.string().min(1).max(32_768);
const GitCreationTerminalResultSchema = z.discriminatedUnion("kind", [
    GitCreationCompletedEventSchema,
    GitCreationFailedEventSchema,
    GitCreationCancelledEventSchema,
]);

export interface DesktopTrpcProcedureContract {
    readonly type: DesktopTrpcOperationType;
    readonly authorization: DesktopTrpcAuthorization;
    readonly input: z.ZodType;
    readonly output: z.ZodType;
}

const procedureContracts = new Map<string, DesktopTrpcProcedureContract>();

function registerProcedureContract(
    domain: DesktopTrpcDomain,
    procedure: string,
    type: DesktopTrpcOperationType,
    authorization: DesktopTrpcAuthorization,
    input: z.ZodType,
    output: z.ZodType,
): void {
    const path = `${domain}.${procedure}`;
    if (procedureContracts.has(path)) {
        throw new Error(`Duplicate desktop tRPC procedure ${path}`);
    }
    procedureContracts.set(path, { type, authorization, input, output });
}

export function desktopTrpcProcedureContract(
    domain: DesktopTrpcDomain,
    procedure: string,
): DesktopTrpcProcedureContract | undefined {
    return procedureContracts.get(`${domain}.${procedure}`);
}

function authorizedProcedure<
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
>(
    authorization: DesktopTrpcAuthorization,
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
) {
    return t.procedure
        .input(input)
        .output(output)
        .use(async ({ ctx, getRawInput, next }) => {
            await ctx.authorize(
                authorization,
                domain,
                procedure,
                await getRawInput(),
            );
            return next();
        });
}

function trustedProcedure<TInput extends z.ZodType, TOutput extends z.ZodType>(
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
) {
    return authorizedProcedure(
        { kind: "trusted" },
        domain,
        procedure,
        input,
        output,
    );
}

function activeCapabilityProcedure<
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
>(
    capability: DesktopTrpcCapability,
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
) {
    return authorizedProcedure(
        { kind: "activeCapability", capability },
        domain,
        procedure,
        input,
        output,
    );
}

function repositoryCapabilityProcedure<
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
>(
    capability: DesktopTrpcCapability,
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
) {
    return authorizedProcedure(
        { kind: "repositoryCapability", capability },
        domain,
        procedure,
        input,
        output,
    );
}

function procedureWithAuthorization<
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
>(
    authorization: DesktopTrpcAuthorization,
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
) {
    switch (authorization.kind) {
        case "trusted":
            return trustedProcedure(domain, procedure, input, output);
        case "activeCapability":
            return activeCapabilityProcedure(
                authorization.capability,
                domain,
                procedure,
                input,
                output,
            );
        case "repositoryCapability":
            return repositoryCapabilityProcedure(
                authorization.capability,
                domain,
                procedure,
                input,
                output,
            );
    }
}

function query<TInput extends z.ZodType, TOutput extends z.ZodType>(
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
    authorization: DesktopTrpcAuthorization = { kind: "trusted" },
) {
    registerProcedureContract(
        domain,
        procedure,
        "query",
        authorization,
        input,
        output,
    );
    const configured = procedureWithAuthorization(
        authorization,
        domain,
        procedure,
        input,
        output,
    );
    const resolver = async ({
        ctx,
        input: validatedInput,
    }: {
        readonly ctx: DesktopTrpcContext;
        readonly input: z.output<TInput>;
    }) => output.parse(await ctx.invoke(domain, procedure, validatedInput));
    return configured.query(resolver as Parameters<typeof configured.query>[0]);
}

function mutation<TInput extends z.ZodType, TOutput extends z.ZodType>(
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
    authorization: DesktopTrpcAuthorization = { kind: "trusted" },
) {
    registerProcedureContract(
        domain,
        procedure,
        "mutation",
        authorization,
        input,
        output,
    );
    const configured = procedureWithAuthorization(
        authorization,
        domain,
        procedure,
        input,
        output,
    );
    const resolver = async ({
        ctx,
        input: validatedInput,
    }: {
        readonly ctx: DesktopTrpcContext;
        readonly input: z.output<TInput>;
    }) => output.parse(await ctx.invoke(domain, procedure, validatedInput));
    return configured.mutation(
        resolver as Parameters<typeof configured.mutation>[0],
    );
}

export const platformProcedures = {
    runtimeInfo: query(
        "platform",
        "runtimeInfo",
        VoidSchema,
        RuntimeInfoSchema,
    ),
    runtimeLauncherInfo: query(
        "platform",
        "runtimeLauncherInfo",
        VoidSchema,
        CommandLineLauncherInfoSchema,
    ),
    windowGetFullScreen: query(
        "platform",
        "windowGetFullScreen",
        VoidSchema,
        BooleanSchema,
    ),
    windowSetFullScreen: mutation(
        "platform",
        "windowSetFullScreen",
        BooleanSchema,
        VoidSchema,
    ),
    windowSetPresentationMode: mutation(
        "platform",
        "windowSetPresentationMode",
        WindowPresentationModeSchema,
        VoidSchema,
    ),
    maintenanceRelaunch: mutation(
        "platform",
        "maintenanceRelaunch",
        MaintenanceRelaunchRequestSchema,
        VoidSchema,
    ),
    diagnosticsSnapshot: query(
        "platform",
        "diagnosticsSnapshot",
        VoidSchema,
        DiagnosticSnapshotSchema,
    ),
    diagnosticsReveal: mutation(
        "platform",
        "diagnosticsReveal",
        DiagnosticPathKindSchema,
        VoidSchema,
    ),
    diagnosticsCollectLogs: mutation(
        "platform",
        "diagnosticsCollectLogs",
        VoidSchema,
        BooleanSchema,
    ),
    diagnosticsDumpThreads: mutation(
        "platform",
        "diagnosticsDumpThreads",
        VoidSchema,
        DiagnosticPathResultSchema,
    ),
    diagnosticsReadConfiguration: query(
        "platform",
        "diagnosticsReadConfiguration",
        DiagnosticConfigurationKindSchema,
        DiagnosticConfigurationTextSchema,
    ),
    diagnosticsWriteConfiguration: mutation(
        "platform",
        "diagnosticsWriteConfiguration",
        DiagnosticConfigurationWriteRequestSchema,
        VoidSchema,
    ),
    diagnosticsKeyboardShortcutsPdf: mutation(
        "platform",
        "diagnosticsKeyboardShortcutsPdf",
        VoidSchema,
        VoidSchema,
    ),
    diagnosticsListLeftoverDirectories: query(
        "platform",
        "diagnosticsListLeftoverDirectories",
        VoidSchema,
        DiagnosticLeftoverDirectoriesSchema,
    ),
    diagnosticsDeleteLeftoverDirectories: mutation(
        "platform",
        "diagnosticsDeleteLeftoverDirectories",
        DiagnosticDeleteLeftoverDirectoriesRequestSchema,
        DiagnosticDeletedLeftoverDirectoryIdsSchema,
    ),
    exportHtml: mutation(
        "platform",
        "exportHtml",
        HtmlExportRequestSchema,
        BooleanSchema,
    ),
    exportPatchText: mutation(
        "platform",
        "exportPatchText",
        PatchTextExportRequestSchema,
        BooleanSchema,
    ),
    analysisOpenOfflineInspection: mutation(
        "platform",
        "analysisOpenOfflineInspection",
        VoidSchema,
        OfflineInspectionFilesSchema.nullable(),
    ),
    settingsGet: query(
        "platform",
        "settingsGet",
        SettingsGetRequestSchema,
        JsonValueSchema.nullable(),
    ),
    settingsSet: mutation(
        "platform",
        "settingsSet",
        SettingsSetRequestSchema,
        VoidSchema,
    ),
    settingsDelete: mutation(
        "platform",
        "settingsDelete",
        SettingsDeleteRequestSchema,
        VoidSchema,
    ),
    settingsExport: mutation(
        "platform",
        "settingsExport",
        VoidSchema,
        BooleanSchema,
    ),
    settingsImport: mutation(
        "platform",
        "settingsImport",
        VoidSchema,
        BooleanSchema,
    ),
    dialogOpenDirectory: mutation(
        "platform",
        "dialogOpenDirectory",
        DialogRequestSchema,
        DialogSelectionSchema,
    ),
    dialogOpenFile: mutation(
        "platform",
        "dialogOpenFile",
        DialogRequestSchema,
        DialogSelectionSchema,
    ),
    dialogSaveFile: mutation(
        "platform",
        "dialogSaveFile",
        DialogRequestSchema,
        DialogSelectionSchema,
    ),
    shellOpenExternal: mutation(
        "platform",
        "shellOpenExternal",
        ExternalUrlSchema,
        VoidSchema,
    ),
    clipboardWriteText: mutation(
        "platform",
        "clipboardWriteText",
        ClipboardWriteRequestSchema,
        VoidSchema,
    ),
    clipboardReadText: query(
        "platform",
        "clipboardReadText",
        VoidSchema,
        ClipboardTextSchema,
    ),
    menuSyncState: mutation(
        "platform",
        "menuSyncState",
        NativeCommandStatesSchema,
        VoidSchema,
    ),
} as const;

export const gitProcedures = {
    openRepository: mutation(
        "git",
        "openRepository",
        OpenRepositoryRequestSchema,
        RepositoryRecordSchema,
    ),
    initializeRepository: mutation(
        "git",
        "initializeRepository",
        GitInitializeRepositoryRequestSchema,
        GitCreationTerminalResultSchema,
        { kind: "activeCapability", capability: "gitMutation" },
    ),
    cloneRepository: mutation(
        "git",
        "cloneRepository",
        GitCloneRepositoryRequestSchema,
        GitCreationTerminalResultSchema,
        { kind: "activeCapability", capability: "gitMutation" },
    ),
    closeRepository: mutation(
        "git",
        "closeRepository",
        GitCloseRepositoryRequestSchema,
        BooleanSchema,
    ),
    inspectSnapshot: query(
        "git",
        "inspectSnapshot",
        GitRepositoryRequestSchema,
        RepositorySnapshotSchema,
    ),
    repositoryService: mutation(
        "git",
        "repositoryService",
        GitRepositoryServiceRequestSchema,
        GitRepositoryServiceResultSchema,
        { kind: "repositoryCapability", capability: "gitMutation" },
    ),
    query: mutation(
        "git",
        "query",
        GitExecutionRequestSchema,
        GitTerminalResultSchema,
        {
            kind: "repositoryCapability",
            capability: "gitMutation",
        },
    ),
    cancelQuery: mutation(
        "git",
        "cancelQuery",
        GitCancelQueryRequestSchema,
        BooleanSchema,
    ),
    readFile: query(
        "git",
        "readFile",
        GitReadFileRequestSchema,
        FileContentSchema,
    ),
    readFilePreview: query(
        "git",
        "readFilePreview",
        GitReadFileRequestSchema,
        FilePreviewSchema,
    ),
    writeWorkingTreeFile: mutation(
        "git",
        "writeWorkingTreeFile",
        GitWriteWorkingTreeFileRequestSchema,
        VoidSchema,
        { kind: "repositoryCapability", capability: "gitMutation" },
    ),
    openWorkingTreeFile: mutation(
        "git",
        "openWorkingTreeFile",
        GitWorkingTreeFileRequestSchema,
        VoidSchema,
        { kind: "repositoryCapability", capability: "externalExecution" },
    ),
    watchRepository: mutation(
        "git",
        "watchRepository",
        GitWatchRepositoryRequestSchema,
        VoidSchema,
    ),
    unwatchRepository: mutation(
        "git",
        "unwatchRepository",
        GitWatchRepositoryRequestSchema,
        VoidSchema,
    ),
} as const;

export const terminalProcedures = {
    create: mutation(
        "terminal",
        "create",
        TerminalCreateRequestSchema,
        TerminalCreateResultSchema,
        {
            kind: "repositoryCapability",
            capability: "terminal",
        },
    ),
    listLaunchTargets: query(
        "terminal",
        "listLaunchTargets",
        TerminalListLaunchTargetsRequestSchema,
        TerminalLaunchTargetsSchema,
        { kind: "activeCapability", capability: "terminal" },
    ),
    write: mutation(
        "terminal",
        "write",
        TerminalWriteRequestSchema,
        VoidSchema,
    ),
    resize: mutation(
        "terminal",
        "resize",
        TerminalResizeRequestSchema,
        VoidSchema,
    ),
    close: mutation(
        "terminal",
        "close",
        TerminalCloseRequestSchema,
        VoidSchema,
    ),
    closeRepository: mutation(
        "terminal",
        "closeRepository",
        TerminalCloseRepositoryRequestSchema,
        VoidSchema,
    ),
} as const;

export const hostingProcedures = {
    saveAccount: mutation(
        "hosting",
        "saveAccount",
        HostingSaveAccountRequestSchema,
        HostingAccountSchema,
        { kind: "activeCapability", capability: "hosting" },
    ),
    restoreAccounts: mutation(
        "hosting",
        "restoreAccounts",
        HostingRestoreAccountsRequestSchema,
        VoidSchema,
        { kind: "activeCapability", capability: "hosting" },
    ),
    deleteAccount: mutation(
        "hosting",
        "deleteAccount",
        HostingDeleteAccountRequestSchema,
        VoidSchema,
        { kind: "activeCapability", capability: "hosting" },
    ),
    execute: mutation(
        "hosting",
        "execute",
        HostingExecuteRequestSchema,
        HostingResponseSchema,
        {
            kind: "activeCapability",
            capability: "hosting",
        },
    ),
} as const;

export const localHistoryProcedures = {
    repositoryService: mutation(
        "localHistory",
        "repositoryService",
        LocalHistoryRepositoryRequestSchema,
        GitRepositoryServiceResultSchema,
        { kind: "repositoryCapability", capability: "gitMutation" },
    ),
} as const;

export const mainDesktopTrpcRouter = t.router({
    platform: t.router(platformProcedures),
    git: t.router(gitProcedures),
    terminal: t.router(terminalProcedures),
    hosting: t.router(hostingProcedures),
});

export const localHistoryDesktopTrpcRouter = t.router({
    localHistory: t.router(localHistoryProcedures),
});

export type MainDesktopTrpcRouter = typeof mainDesktopTrpcRouter;
export type LocalHistoryDesktopTrpcRouter =
    typeof localHistoryDesktopTrpcRouter;

function procedureKeys<TProcedures extends object>(procedures: TProcedures) {
    return Object.keys(procedures) as Extract<keyof TProcedures, string>[];
}

export const MAIN_DESKTOP_TRPC_PROCEDURE_KEYS = {
    platform: procedureKeys(platformProcedures),
    git: procedureKeys(gitProcedures),
    terminal: procedureKeys(terminalProcedures),
    hosting: procedureKeys(hostingProcedures),
} as const;

export const LOCAL_HISTORY_TRPC_PROCEDURE_KEYS = {
    localHistory: procedureKeys(localHistoryProcedures),
} as const;
