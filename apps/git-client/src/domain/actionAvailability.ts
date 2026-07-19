import type { ActionAvailability, SelectionContext } from "./types";

export function deriveActionAvailability(context: SelectionContext): ActionAvailability {
  const selectedCount = context.selectedCommits.length;
  const exactlyOne = selectedCount === 1;
  const selected = exactlyOne ? context.selectedCommits[0] : undefined;
  const hasWritableBranch = Boolean(context.currentBranch) && !context.operationInProgress;
  const selectedIsHead = selected?.oid === context.headOid;

  return {
    copyRevision: exactlyOne,
    createPatch: selectedCount > 0,
    copyPatch: selectedCount > 0,
    cherryPick: selectedCount > 0 && hasWritableBranch && !selectedIsHead,
    showRepositoryAtRevision: exactlyOne,
    compareVersions: selectedCount === 2,
    reset: exactlyOne && hasWritableBranch,
    revert: selectedCount > 0 && hasWritableBranch,
    undoCommit: exactlyOne && hasWritableBranch && Boolean(selectedIsHead),
    reword: exactlyOne && hasWritableBranch && context.selectedIsAncestorOfHead,
    fixup: exactlyOne && hasWritableBranch && !selectedIsHead,
    squashInto: exactlyOne && hasWritableBranch && !selectedIsHead,
    drop: exactlyOne && hasWritableBranch && context.selectedIsAncestorOfHead && !selectedIsHead,
    squash:
      selectedCount > 1 &&
      hasWritableBranch &&
      context.selectedIsAncestorOfHead &&
      context.selectedAreContiguousFirstParent &&
      !context.selectedIncludesMerge,
    interactiveRebase: exactlyOne && hasWritableBranch && context.selectedIsAncestorOfHead,
    pushUpTo:
      exactlyOne &&
      hasWritableBranch &&
      Boolean(context.upstream) &&
      context.selectedIsAncestorOfHead &&
      context.selectedIsAheadOfUpstream,
    newBranch: exactlyOne && context.repositoryHasCommits,
    newTag: exactlyOne && context.repositoryHasCommits,
    goToChild: exactlyOne && context.hasChild,
    goToParent: exactlyOne && Boolean(selected?.parents.length),
    viewInBrowser: exactlyOne,
  };
}
