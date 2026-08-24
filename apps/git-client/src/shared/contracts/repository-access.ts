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
    super(
      `${SAFE_MODE_CAPABILITY_LABELS[capability]} is unavailable in Safe Mode.`,
    );
    this.name = "SafeModeViolationError";
    this.capability = capability;
  }
}
