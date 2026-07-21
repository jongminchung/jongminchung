export type MvpLane = "welcome" | "log" | "changes" | "terminal";
export type MvpRepositoryState = "clean" | "dirty" | "staged" | "conflict";

export interface MvpFixtureSlice {
  readonly id: string;
  readonly lane: MvpLane;
  readonly repositoryState: MvpRepositoryState | null;
  readonly themes: readonly ["light", "dark"];
  readonly densities: readonly ["regular", "compact"];
}

export interface MvpFixtureContract {
  readonly schemaVersion: 1;
  readonly referenceVersion: "1.1.8";
  readonly clock: Readonly<{
    iso: string;
    timezone: "UTC";
    locale: string;
  }>;
  readonly gitIdentity: Readonly<{ name: string; email: string }>;
  readonly slices: readonly MvpFixtureSlice[];
}

export interface CanonicalGitFixture {
  readonly repositoryPath: string;
  readonly remotePath: string;
  readonly normalized: Readonly<{
    branch: string;
    commitOids: readonly string[];
    commitSubjects: readonly string[];
    changedPaths: readonly string[];
    remoteRefs: readonly string[];
  }>;
}

export type CanonicalGitFixtureState = CanonicalGitFixture["normalized"];

export function loadMvpFixtureContract(path?: string): MvpFixtureContract;
export function createCanonicalGitFixture(
  options: Readonly<{
    parentDirectory: string;
    state: MvpRepositoryState;
  }>,
): CanonicalGitFixture;
export function captureCanonicalGitFixtureState(
  fixture: Pick<CanonicalGitFixture, "repositoryPath" | "remotePath">,
): CanonicalGitFixtureState;
export const MVP_FIXTURE_CONTRACT_PATH: string;
