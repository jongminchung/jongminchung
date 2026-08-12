import { z } from "zod";

export const QA_FIXTURE_RENDERER_ARGUMENT = "--git-client-qa-fixture";
import {
  HostingAccountIdSchema,
  HostingAccountsSchema,
  HostingRequestSchema,
  SaveHostingAccountSchema,
} from "../../../electron/hosting/hosting-contract";
import {
  GitCancelledEventSchema,
  GitCompletedEventSchema,
  GitFailedEventSchema,
  GitRequestIdSchema,
  RepositoryIdSchema,
} from "./git-utility";

export const WindowPresentationModeSchema = z.enum(["welcome", "workspace"]);
export type WindowPresentationMode = z.infer<typeof WindowPresentationModeSchema>;

export const JsonValueSchema = z.json();
export type JsonValue = z.infer<typeof JsonValueSchema>;

export const RuntimeInfoSchema = z.object({
  kind: z.literal("electron"),
  appVersion: z.string().min(1),
  electronVersion: z.string().min(1),
  platform: z.string().min(1),
  architecture: z.string().min(1),
  qaFixture: z.boolean(),
});
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;

export const CommandLineLauncherInfoSchema = z
  .object({
    directory: z.string().min(1).max(32_768),
    command: z.string().min(1).max(256),
  })
  .strict()
  .readonly();
export type CommandLineLauncherInfo = z.infer<typeof CommandLineLauncherInfoSchema>;

export const SettingsKeySchema = z.string().min(1).max(256);
export const SettingsGetRequestSchema = z.object({ key: SettingsKeySchema });
export const SettingsSetRequestSchema = z.object({
  key: SettingsKeySchema,
  value: JsonValueSchema,
});
export const SettingsDeleteRequestSchema = z.object({ key: SettingsKeySchema });

export const DialogRequestSchema = z.object({
  title: z.string().min(1).max(256),
  defaultPath: z.string().min(1).nullable(),
  filters: z
    .array(
      z.object({
        name: z.string().min(1).max(128),
        extensions: z.array(z.string().min(1).max(32)).max(32),
      }),
    )
    .max(32),
});
export type DialogRequest = z.infer<typeof DialogRequestSchema>;

export const DialogSelectionSchema = z.string().min(1).nullable();
export type DialogSelection = z.infer<typeof DialogSelectionSchema>;

export const ExternalUrlSchema = z
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === ""
    );
  }, "Only credential-free HTTP or HTTPS URLs are allowed");

export const ClipboardWriteRequestSchema = z.object({
  text: z.string().max(1_000_000),
});

export const MaintenanceRelaunchRequestSchema = z
  .object({ invalidateCaches: z.boolean() })
  .strict()
  .readonly();

export const DiagnosticPathKindSchema = z.enum([
  "logs",
  "settings",
  "caches",
  "crashDumps",
  "customProperties",
  "vmOptions",
]);
export type DiagnosticPathKind = z.infer<typeof DiagnosticPathKindSchema>;

export const DiagnosticConfigurationKindSchema = z.enum([
  "debugLog",
  "customProperties",
  "vmOptions",
]);
export type DiagnosticConfigurationKind = z.infer<typeof DiagnosticConfigurationKindSchema>;

export const DiagnosticConfigurationWriteRequestSchema = z
  .object({
    kind: DiagnosticConfigurationKindSchema,
    content: z.string().max(1_048_576),
  })
  .strict()
  .readonly();

export const DiagnosticProcessSchema = z
  .object({
    pid: z.number().int().positive(),
    type: z.string().min(1).max(128),
    cpuPercent: z.number().finite().nonnegative(),
    memoryBytes: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export type DiagnosticProcess = z.infer<typeof DiagnosticProcessSchema>;

export const DiagnosticSnapshotSchema = z
  .object({
    capturedAt: z.string().datetime(),
    uptimeSeconds: z.number().finite().nonnegative(),
    processes: z.array(DiagnosticProcessSchema).max(128).readonly(),
  })
  .strict()
  .readonly();
export type DiagnosticSnapshot = z.infer<typeof DiagnosticSnapshotSchema>;

export const DiagnosticLeftoverDirectoryIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^Git Client Electron(?:$|[ -][A-Za-z0-9 ._-]+)$/u,
    "Leftover directory IDs must identify a Git Client Electron profile",
  );

export const DiagnosticLeftoverDirectorySchema = z
  .object({
    id: DiagnosticLeftoverDirectoryIdSchema,
    name: z.string().min(1).max(128),
    lastModifiedMs: z.number().int().nonnegative(),
    sizeBytes: z.number().int().nonnegative(),
  })
  .strict()
  .readonly();
export type DiagnosticLeftoverDirectory = z.infer<typeof DiagnosticLeftoverDirectorySchema>;

export const DiagnosticLeftoverDirectoriesSchema = z
  .array(DiagnosticLeftoverDirectorySchema)
  .max(32)
  .readonly();

export const DiagnosticDeleteLeftoverDirectoriesRequestSchema = z
  .object({
    ids: z
      .array(DiagnosticLeftoverDirectoryIdSchema)
      .min(1)
      .max(32)
      .refine((ids) => new Set(ids).size === ids.length, "Leftover directory IDs must be unique"),
  })
  .strict()
  .readonly();

export const DiagnosticDeletedLeftoverDirectoryIdsSchema = z
  .array(DiagnosticLeftoverDirectoryIdSchema)
  .max(32)
  .readonly();

const HtmlExportPathSchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "HTML export paths must be safe relative POSIX paths",
  );

export const HtmlExportRequestSchema = z
  .object({
    files: z
      .array(
        z
          .object({
            path: HtmlExportPathSchema,
            content: z.string().max(5_242_880),
          })
          .strict()
          .readonly(),
      )
      .min(1)
      .max(1_000),
    includeLineNumbers: z.boolean(),
    openInBrowser: z.boolean(),
  })
  .strict()
  .readonly()
  .refine(
    (value) => value.files.reduce((total, file) => total + file.content.length, 0) <= 20_971_520,
    "HTML export content exceeds 20 MiB",
  );
export type HtmlExportRequest = z.infer<typeof HtmlExportRequestSchema>;

export const PatchTextExportRequestSchema = z
  .object({
    defaultName: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => !value.includes("/") && !value.includes("\\") && !value.includes("\0")),
    content: z.string().min(1).max(16_777_216),
  })
  .strict()
  .readonly();
export type PatchTextExportRequest = z.infer<typeof PatchTextExportRequestSchema>;

export const ClipboardTextSchema = z.string().max(16_777_216);

export const OfflineInspectionFilesSchema = z
  .array(
    z
      .object({
        name: z.string().min(1).max(512),
        content: z.string().max(5_242_880),
      })
      .strict()
      .readonly(),
  )
  .max(100)
  .refine(
    (files) => files.reduce((total, file) => total + file.content.length, 0) <= 20_971_520,
    "Offline inspection results exceed 20 MiB",
  );
export type OfflineInspectionFile = z.infer<typeof OfflineInspectionFilesSchema>[number];

export const NativeCommandSchema = z.object({
  id: z.string().min(1).max(256),
});
export type NativeCommand = z.infer<typeof NativeCommandSchema>;

export const NativeCommandStateSchema = z.object({
  id: z.string().min(1).max(256),
  label: z.string().min(1).max(256).optional(),
  enabled: z.boolean(),
  visible: z.boolean(),
  checked: z.boolean().nullable(),
  accelerator: z.string().min(1).max(128).nullable(),
});
export type NativeCommandState = z.infer<typeof NativeCommandStateSchema>;

export const NativeCommandStatesSchema = z.array(NativeCommandStateSchema).max(1_000);

export const GitRepositoryRequestSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
  })
  .strict()
  .readonly();

export const GitCloseRepositoryRequestSchema = GitRepositoryRequestSchema;

export const GitCancelQueryRequestSchema = z
  .object({
    requestId: GitRequestIdSchema,
  })
  .strict()
  .readonly();

export const GitTerminalResultSchema = z
  .discriminatedUnion("kind", [
    GitCompletedEventSchema,
    GitFailedEventSchema,
    GitCancelledEventSchema,
  ])
  .readonly();

export const HostingSaveAccountRequestSchema = SaveHostingAccountSchema;

export const HostingRestoreAccountsRequestSchema = z
  .object({ accounts: HostingAccountsSchema })
  .strict()
  .readonly();

export const HostingDeleteAccountRequestSchema = z
  .object({ accountId: HostingAccountIdSchema })
  .strict()
  .readonly();

export const HostingExecuteRequestSchema = z
  .object({
    accountId: HostingAccountIdSchema,
    request: HostingRequestSchema,
  })
  .strict()
  .readonly();
