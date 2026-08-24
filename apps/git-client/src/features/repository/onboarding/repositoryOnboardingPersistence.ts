const STORAGE_KEY = "git-client.repository-onboarding.v1";

interface StoredState {
  readonly dismissed: Readonly<Record<string, true>>;
}

function read(storage: Pick<Storage, "getItem">): StoredState {
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof value !== "object" || value === null) return { dismissed: {} };
    const dismissed = Reflect.get(value, "dismissed");
    if (typeof dismissed !== "object" || dismissed === null)
      return { dismissed: {} };
    const validated: Record<string, true> = {};
    for (const [repositoryId, value] of Object.entries(dismissed)) {
      if (value === true) validated[repositoryId] = true;
    }
    return { dismissed: validated };
  } catch {
    return { dismissed: {} };
  }
}

export function repositoryOnboardingDismissed(
  storage: Pick<Storage, "getItem">,
  repositoryId: string,
): boolean {
  return read(storage).dismissed[repositoryId] === true;
}

export function setRepositoryOnboardingDismissed(
  storage: Pick<Storage, "getItem" | "setItem">,
  repositoryId: string,
  dismissed: boolean,
): void {
  const current = read(storage);
  const next = { ...current.dismissed };
  if (dismissed) next[repositoryId] = true;
  else delete next[repositoryId];
  storage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: next }));
}
