import { z } from "zod";
import {
  GitCreationEventSchema,
  GitRequestEventSchema,
  GitRequestIdSchema,
  RepositoryChangedEventSchema,
} from "./git-utility";
import { NativeCommandSchema } from "./ipc";
import { TerminalEventEnvelopeSchema } from "./terminal";

export const DESKTOP_STREAM_CHANNEL = "git-client:stream:connect";
export const DESKTOP_STREAM_PROTOCOL_VERSION = 1 as const;

export const DesktopStreamConnectSchema = z
  .object({ version: z.literal(DESKTOP_STREAM_PROTOCOL_VERSION) })
  .strict()
  .readonly();

export const DesktopStreamEnvelopeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("ready"),
      version: z.literal(DESKTOP_STREAM_PROTOCOL_VERSION),
    })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("menu.command"), command: NativeCommandSchema })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("terminal.event"), event: TerminalEventEnvelopeSchema })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("git.query.event"), event: GitRequestEventSchema })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("git.creation.event"), event: GitCreationEventSchema })
    .strict()
    .readonly(),
  z
    .object({ kind: z.literal("repository.changed"), event: RepositoryChangedEventSchema })
    .strict()
    .readonly(),
  z
    .object({
      kind: z.literal("git.barrier"),
      operation: z.enum(["query", "creation"]),
      requestId: GitRequestIdSchema,
    })
    .strict()
    .readonly(),
]);

export type DesktopStreamEnvelope = Readonly<z.infer<typeof DesktopStreamEnvelopeSchema>>;
export type DesktopStreamEventKind = Exclude<DesktopStreamEnvelope["kind"], "ready">;
