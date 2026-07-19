import { z } from "zod";

export const RepositoryIdSchema = z.uuid();
export type RepositoryId = z.infer<typeof RepositoryIdSchema>;

export const GitRequestIdSchema = z.uuid();
export type GitRequestId = z.infer<typeof GitRequestIdSchema>;
