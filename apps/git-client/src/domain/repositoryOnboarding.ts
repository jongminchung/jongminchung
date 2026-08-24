import type { CommandId } from "./commands";
import type { RepositoryView } from "./types";

export type RepositoryOnboardingTaskId =
  | "resolve-conflicts"
  | "choose-branch"
  | "review-changes"
  | "commit-changes"
  | "configure-remote"
  | "configure-upstream"
  | "publish-commits"
  | "connect-hosting";

export interface RepositoryOnboardingTask {
  readonly id: RepositoryOnboardingTaskId;
  readonly title: string;
  readonly description: string;
  readonly commandId: CommandId;
  readonly complete: boolean;
  readonly disabledReason?: string;
}

export interface RepositoryOnboardingContext {
  readonly hostingAccountConnected: boolean;
  readonly online: boolean;
  readonly remotes: readonly unknown[];
  readonly repository: RepositoryView;
  readonly safeMode: boolean;
}

const SAFE_MODE_REASON =
  "Trust this repository to run Git mutations. Read-only inspection remains available.";

function mutationReason(
  context: RepositoryOnboardingContext,
  network: boolean,
): string | undefined {
  if (context.safeMode) return SAFE_MODE_REASON;
  if (context.repository.snapshot.operation !== null)
    return `Finish or abort the current ${context.repository.snapshot.operation} operation first.`;
  if (network && !context.online)
    return "Reconnect to the network before running this action.";
  return undefined;
}

/** repository의 실제 Git 상태에서 온보딩 checklist를 계산함 */
export function deriveRepositoryOnboardingTasks(
  context: RepositoryOnboardingContext,
): readonly RepositoryOnboardingTask[] {
  const { repository } = context;
  const changes = repository.status.changes;
  const conflicted = changes.some((change) => change.status === "conflicted");
  const hasRemote =
    context.remotes.length > 0 || repository.snapshot.remoteUrl !== null;
  const hasBranch =
    repository.snapshot.currentBranch !== null &&
    !repository.snapshot.isDetached;
  const mutationDisabled = mutationReason(context, false);
  const networkDisabled = mutationReason(context, true);
  const tasks: RepositoryOnboardingTask[] = [];

  if (conflicted) {
    tasks.push({
      id: "resolve-conflicts",
      title: "Resolve repository conflicts",
      description:
        "Open the conflict tool before committing or publishing work.",
      commandId: "repository.resolveConflicts",
      complete: false,
      disabledReason: context.safeMode ? SAFE_MODE_REASON : undefined,
    });
  }
  if (!hasBranch) {
    tasks.push({
      id: "choose-branch",
      title: "Create or check out a branch",
      description:
        "Publishing from a detached HEAD requires an explicit branch.",
      commandId: "repository.branches",
      complete: false,
      disabledReason: mutationDisabled,
    });
  }
  tasks.push(
    {
      id: "review-changes",
      title: "Review local changes",
      description:
        changes.length === 0
          ? "The working tree has no unreviewed changes."
          : `${changes.length} changed file${changes.length === 1 ? "" : "s"} ready to inspect.`,
      commandId: "view.changes",
      complete: changes.length === 0,
      disabledReason: context.safeMode
        ? "The Changes workflow is unavailable in Safe Mode; repository history remains readable."
        : undefined,
    },
    {
      id: "commit-changes",
      title: "Stage and commit changes",
      description:
        changes.length === 0
          ? "The working tree is clean."
          : "Use the existing Changes workflow to stage and commit selected files.",
      commandId: "changes.commit",
      complete: changes.length === 0 && repository.snapshot.hasCommits,
      disabledReason:
        changes.length === 0
          ? "Create or edit a file before committing."
          : mutationDisabled,
    },
    {
      id: "configure-remote",
      title: "Configure a remote",
      description: hasRemote
        ? "A remote repository is configured."
        : "Add or share a remote before the first push.",
      commandId: "repository.manageRemotes",
      complete: hasRemote,
      disabledReason: mutationDisabled,
    },
    {
      id: "configure-upstream",
      title: "Publish the current branch",
      description:
        repository.snapshot.upstream !== null
          ? `Tracking ${repository.snapshot.upstream}.`
          : "The first push will choose a destination and establish tracking.",
      commandId: "repository.push",
      complete: repository.snapshot.upstream !== null,
      disabledReason: !hasBranch
        ? "Create or check out a branch before publishing."
        : !hasRemote
          ? "Configure a remote before publishing."
          : networkDisabled,
    },
    {
      id: "publish-commits",
      title: "Push unpublished commits",
      description:
        repository.snapshot.ahead > 0
          ? `${repository.snapshot.ahead} local commit${repository.snapshot.ahead === 1 ? "" : "s"} not published yet.`
          : "The current branch has no unpublished commits.",
      commandId: "repository.push",
      complete:
        repository.snapshot.upstream !== null &&
        repository.snapshot.ahead === 0,
      disabledReason:
        repository.snapshot.upstream === null
          ? "Publish the branch once to establish tracking."
          : networkDisabled,
    },
    {
      id: "connect-hosting",
      title: "Connect a hosting account",
      description: context.hostingAccountConnected
        ? "A GitHub or GitLab account is available for change requests."
        : "Connect the Hosting tool before creating a pull or merge request.",
      commandId: "repository.manageAccounts",
      complete: context.hostingAccountConnected,
      disabledReason: context.safeMode
        ? "Hosting credentials are unavailable while this repository is in Safe Mode."
        : undefined,
    },
  );
  return Object.freeze(tasks.map((task) => Object.freeze(task)));
}
