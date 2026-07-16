export type PersistedWorkspaceTab =
  | { readonly kind: "manage" }
  | { readonly kind: "repository"; readonly repositoryId: string }
  | { readonly kind: "error"; readonly sessionId: string };

export type PersistableWorkspaceSession =
  | {
      readonly kind: "repository";
      readonly repository: { readonly snapshot: { readonly id: string; readonly path: string } };
    }
  | { readonly kind: "error"; readonly id: string; readonly path: string };

export function workspacePaths(
  sessions: readonly PersistableWorkspaceSession[],
): readonly string[] {
  return sessions.map((session) =>
    session.kind === "repository" ? session.repository.snapshot.path : session.path,
  );
}

export function restoredWorkspaceTab(
  sessions: readonly PersistableWorkspaceSession[],
  activePath: unknown,
): PersistedWorkspaceTab {
  if (typeof activePath !== "string") return { kind: "manage" };
  const selected = sessions.find((session) =>
    session.kind === "repository"
      ? session.repository.snapshot.path === activePath
      : session.path === activePath,
  );
  if (selected?.kind === "repository") {
    return { kind: "repository", repositoryId: selected.repository.snapshot.id };
  }
  if (selected?.kind === "error") return { kind: "error", sessionId: selected.id };
  return { kind: "manage" };
}
