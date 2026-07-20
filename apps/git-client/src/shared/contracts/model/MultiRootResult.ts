import type { MultiRootOutcome } from "./MultiRootOutcome";
import type { MultiRootRollbackStep } from "./MultiRootRollbackStep";

export type MultiRootResult = {
  outcomes: Array<MultiRootOutcome>;
  rollbackPlan: Array<MultiRootRollbackStep>;
};
