import type { GitRequest } from "../shared/contracts/model";

export type RepositoryAccessMode = "trusted" | "safe";

export type RepositoryCapability =
  | "query"
  | "gitMutation"
  | "terminal"
  | "hosting"
  | "externalExecution";

const SAFE_MODE_CAPABILITY_LABELS = {
  gitMutation: "Git changes",
  terminal: "Terminal access",
  hosting: "Hosting access",
  externalExecution: "External execution",
} as const satisfies Record<Exclude<RepositoryCapability, "query">, string>;

export class SafeModeViolationError extends Error {
  readonly capability: Exclude<RepositoryCapability, "query">;

  constructor(capability: Exclude<RepositoryCapability, "query">) {
    super(`${SAFE_MODE_CAPABILITY_LABELS[capability]} is unavailable in Safe Mode.`);
    this.name = "SafeModeViolationError";
    this.capability = capability;
  }
}

export class RepositoryAccessPolicy {
  readonly #modesByRepository = new Map<string, RepositoryAccessMode>();
  readonly #modesByPath = new Map<string, RepositoryAccessMode>();
  readonly #pathsByRepository = new Map<string, string>();
  #activeRepositoryId: string | null = null;

  private constructor() {}

  static create(): RepositoryAccessPolicy {
    return new RepositoryAccessPolicy();
  }

  open(repositoryId: string, path: string, mode: RepositoryAccessMode): void {
    this.#modesByRepository.set(repositoryId, mode);
    this.#pathsByRepository.set(repositoryId, path);
    this.remember(path, mode);
  }

  remember(path: string, mode: RepositoryAccessMode): void {
    this.#modesByPath.set(path, mode);
  }

  forgetPath(path: string): void {
    this.#modesByPath.delete(path);
  }

  safePaths(paths: readonly string[]): readonly string[] {
    const openSafePaths = new Set(
      [...this.#modesByRepository.entries()].flatMap(([repositoryId, mode]) => {
        const path = this.#pathsByRepository.get(repositoryId);
        return mode === "safe" && path !== undefined ? [path] : [];
      }),
    );
    return [...new Set(paths)].filter(
      (path) => this.modeForPath(path) === "safe" || openSafePaths.has(path),
    );
  }

  activate(repositoryId: string | null): void {
    this.#activeRepositoryId = repositoryId;
  }

  forget(repositoryId: string): void {
    this.#modesByRepository.delete(repositoryId);
    this.#pathsByRepository.delete(repositoryId);
    if (this.#activeRepositoryId === repositoryId) this.#activeRepositoryId = null;
  }

  modeForPath(path: string): RepositoryAccessMode {
    return this.#modesByPath.get(path) ?? "trusted";
  }

  mode(repositoryId: string): RepositoryAccessMode {
    return this.#modesByRepository.get(repositoryId) ?? "trusted";
  }

  activeMode(): RepositoryAccessMode {
    return this.#activeRepositoryId === null ? "trusted" : this.mode(this.#activeRepositoryId);
  }

  allows(repositoryId: string, capability: RepositoryCapability): boolean {
    return capability === "query" || this.mode(repositoryId) === "trusted";
  }

  assert(repositoryId: string, capability: Exclude<RepositoryCapability, "query">): void {
    if (!this.allows(repositoryId, capability)) throw new SafeModeViolationError(capability);
  }

  assertActive(capability: Exclude<RepositoryCapability, "query">): void {
    if (this.#activeRepositoryId === null) return;
    this.assert(this.#activeRepositoryId, capability);
  }
}

export const repositoryAccessPolicy = RepositoryAccessPolicy.create();

export function assertGitRequestAllowed(policy: RepositoryAccessPolicy, request: GitRequest): void {
  if (request.kind === "operation") policy.assert(request.repositoryId, "gitMutation");
}

export function restoreRepositoryAccess(
  policy: RepositoryAccessPolicy,
  repositories: readonly Readonly<{ id: string; path: string }>[],
  safeRepositoryPaths: readonly string[],
): void {
  const safePaths = new Set(safeRepositoryPaths);
  for (const path of safePaths) policy.remember(path, "safe");
  for (const repository of repositories) {
    policy.open(
      repository.id,
      repository.path,
      safePaths.has(repository.path) ? "safe" : "trusted",
    );
  }
}
