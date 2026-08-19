import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
    type DesktopTrpcAuthorization,
    type DesktopTrpcCapability,
    type DesktopTrpcDomain,
    type DesktopTrpcOperationType,
} from "./desktop-trpc-wire";
import { createGitProcedures } from "./desktop-trpc/git";
import { createHostingProcedures } from "./desktop-trpc/hosting";
import { createLocalHistoryProcedures } from "./desktop-trpc/local-history";
import { createSettingsProcedures } from "./desktop-trpc/settings";
import { createTerminalProcedures } from "./desktop-trpc/terminal";
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
    HtmlExportRequestSchema,
    MaintenanceRelaunchRequestSchema,
    NativeCommandStatesSchema,
    OfflineInspectionFilesSchema,
    PatchTextExportRequestSchema,
    RuntimeInfoSchema,
    WindowPresentationModeSchema,
} from "./ipc";
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
const TRUSTED_AUTHORIZATION = { kind: "trusted" } as const;

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

export function query<TInput extends z.ZodType, TOutput extends z.ZodType>(
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
    authorization: DesktopTrpcAuthorization,
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

export function mutation<TInput extends z.ZodType, TOutput extends z.ZodType>(
    domain: DesktopTrpcDomain,
    procedure: string,
    input: TInput,
    output: TOutput,
    authorization: DesktopTrpcAuthorization,
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
        TRUSTED_AUTHORIZATION,
    ),
    runtimeLauncherInfo: query(
        "platform",
        "runtimeLauncherInfo",
        VoidSchema,
        CommandLineLauncherInfoSchema,
        TRUSTED_AUTHORIZATION,
    ),
    windowGetFullScreen: query(
        "platform",
        "windowGetFullScreen",
        VoidSchema,
        BooleanSchema,
        TRUSTED_AUTHORIZATION,
    ),
    windowSetFullScreen: mutation(
        "platform",
        "windowSetFullScreen",
        BooleanSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    windowSetPresentationMode: mutation(
        "platform",
        "windowSetPresentationMode",
        WindowPresentationModeSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    maintenanceRelaunch: mutation(
        "platform",
        "maintenanceRelaunch",
        MaintenanceRelaunchRequestSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsSnapshot: query(
        "platform",
        "diagnosticsSnapshot",
        VoidSchema,
        DiagnosticSnapshotSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsReveal: mutation(
        "platform",
        "diagnosticsReveal",
        DiagnosticPathKindSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsCollectLogs: mutation(
        "platform",
        "diagnosticsCollectLogs",
        VoidSchema,
        BooleanSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsDumpThreads: mutation(
        "platform",
        "diagnosticsDumpThreads",
        VoidSchema,
        DiagnosticPathResultSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsReadConfiguration: query(
        "platform",
        "diagnosticsReadConfiguration",
        DiagnosticConfigurationKindSchema,
        DiagnosticConfigurationTextSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsWriteConfiguration: mutation(
        "platform",
        "diagnosticsWriteConfiguration",
        DiagnosticConfigurationWriteRequestSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsKeyboardShortcutsPdf: mutation(
        "platform",
        "diagnosticsKeyboardShortcutsPdf",
        VoidSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsListLeftoverDirectories: query(
        "platform",
        "diagnosticsListLeftoverDirectories",
        VoidSchema,
        DiagnosticLeftoverDirectoriesSchema,
        TRUSTED_AUTHORIZATION,
    ),
    diagnosticsDeleteLeftoverDirectories: mutation(
        "platform",
        "diagnosticsDeleteLeftoverDirectories",
        DiagnosticDeleteLeftoverDirectoriesRequestSchema,
        DiagnosticDeletedLeftoverDirectoryIdsSchema,
        TRUSTED_AUTHORIZATION,
    ),
    exportHtml: mutation(
        "platform",
        "exportHtml",
        HtmlExportRequestSchema,
        BooleanSchema,
        TRUSTED_AUTHORIZATION,
    ),
    exportPatchText: mutation(
        "platform",
        "exportPatchText",
        PatchTextExportRequestSchema,
        BooleanSchema,
        TRUSTED_AUTHORIZATION,
    ),
    analysisOpenOfflineInspection: mutation(
        "platform",
        "analysisOpenOfflineInspection",
        VoidSchema,
        OfflineInspectionFilesSchema.nullable(),
        TRUSTED_AUTHORIZATION,
    ),
    ...createSettingsProcedures(mutation, query),
    dialogOpenDirectory: mutation(
        "platform",
        "dialogOpenDirectory",
        DialogRequestSchema,
        DialogSelectionSchema,
        TRUSTED_AUTHORIZATION,
    ),
    dialogOpenFile: mutation(
        "platform",
        "dialogOpenFile",
        DialogRequestSchema,
        DialogSelectionSchema,
        TRUSTED_AUTHORIZATION,
    ),
    dialogSaveFile: mutation(
        "platform",
        "dialogSaveFile",
        DialogRequestSchema,
        DialogSelectionSchema,
        TRUSTED_AUTHORIZATION,
    ),
    shellOpenExternal: mutation(
        "platform",
        "shellOpenExternal",
        ExternalUrlSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    clipboardWriteText: mutation(
        "platform",
        "clipboardWriteText",
        ClipboardWriteRequestSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
    clipboardReadText: query(
        "platform",
        "clipboardReadText",
        VoidSchema,
        ClipboardTextSchema,
        TRUSTED_AUTHORIZATION,
    ),
    menuSyncState: mutation(
        "platform",
        "menuSyncState",
        NativeCommandStatesSchema,
        VoidSchema,
        TRUSTED_AUTHORIZATION,
    ),
} as const;

export const gitProcedures = createGitProcedures(mutation, query);

export const terminalProcedures = createTerminalProcedures(
    mutation,
    query,
    VoidSchema,
);

export const hostingProcedures = createHostingProcedures(mutation, VoidSchema);

export const localHistoryProcedures = createLocalHistoryProcedures(mutation);

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
