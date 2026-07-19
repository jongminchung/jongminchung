export const FIXTURE_REPOSITORY_ACTION_ERROR =
    "Real repository actions are disabled while the QA fixture is active.";

export function assertLiveRepositoryActionAllowed(fixture: boolean): void {
    if (fixture) throw new Error(FIXTURE_REPOSITORY_ACTION_ERROR);
}
