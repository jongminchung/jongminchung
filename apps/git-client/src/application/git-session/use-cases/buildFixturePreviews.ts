import type {
    HistoryRewritePreview,
    PushPreview,
} from "../../../shared/contracts/model/index";
import type {
    HistoryRewritePreviewRequest,
    HistoryRewritePreviewSource,
    PushPreviewRequest,
} from "../ports/GitSessionBackend";

const PROTECTED_BRANCHES = new Set(["main", "master", "production", "release"]);

export function buildFixturePushPreview({
    snapshot,
    remote,
    remoteRef,
    localRevision,
}: PushPreviewRequest): PushPreview {
    const branch = snapshot.currentBranch ?? "main";
    const oid = snapshot.headOid ?? "0".repeat(40);
    const destination = remoteRef ?? `refs/heads/${branch}`;
    const destinationBranch = destination.replace(/^refs\/heads\//u, "");
    const diverged = destinationBranch === "diverged";
    const divergedRemoteOid = "fedcba9876543210fedcba9876543210fedcba98";
    const reviewedRemoteOid = diverged
        ? divergedRemoteOid
        : snapshot.upstream
          ? oid
          : null;

    return {
        sourceBranch: snapshot.currentBranch,
        sourceRevision: localRevision,
        localOid: oid,
        remote: remote ?? "origin",
        remoteRef: destination,
        upstreamConfigured: Boolean(snapshot.upstream),
        setUpstreamDefault: !snapshot.upstream,
        remoteOid: reviewedRemoteOid,
        expectedLeaseOid: reviewedRemoteOid,
        ahead: diverged ? 2 : snapshot.ahead,
        behind: diverged ? 1 : snapshot.behind,
        fastForward: !diverged,
        newBranch: false,
        commits: [],
        remoteOnlyCommits: diverged
            ? [
                  {
                      oid: divergedRemoteOid,
                      subject: "Remote-only fixture commit",
                  },
              ]
            : [],
        protectedBranch: PROTECTED_BRANCHES.has(destinationBranch),
        checkedAtMs: Date.now(),
        remoteStateError: null,
        warnings: diverged
            ? ["QA fixture: destination contains remote-only history."]
            : [],
    };
}

export function buildFixtureHistoryRewritePreview({
    repository,
    fromRevision,
}: HistoryRewritePreviewRequest): HistoryRewritePreview {
    assertRepository(repository);
    const start = repository.commits.findIndex(
        (commit) => commit.oid === fromRevision,
    );
    const commits = (
        start < 0 ? repository.commits : repository.commits.slice(0, start + 1)
    ).toReversed();
    const upstreamBoundary = repository.ahead;

    return {
        branch: repository.snapshot.currentBranch ?? "main",
        headOid:
            repository.snapshot.headOid ?? commits.at(-1)?.oid ?? fromRevision,
        base: commits[0]?.parents[0] ?? null,
        root: (commits[0]?.parents.length ?? 0) === 0,
        entries: commits.map((commit, index) => ({
            oid: commit.oid,
            subject: commit.subject,
            parents: [...commit.parents],
            action: "pick",
            message: null,
            published: index < Math.max(0, commits.length - upstreamBoundary),
            mergeCommit: commit.parents.length > 1,
        })),
        publishedCommitCount: Math.max(0, commits.length - upstreamBoundary),
        descendantCount: commits.length,
        dependentRefs: [],
        hasMerges: commits.some((commit) => commit.parents.length > 1),
        protectedBranch: PROTECTED_BRANCHES.has(
            repository.snapshot.currentBranch ?? "",
        ),
        warnings: [],
    };
}

function assertRepository(
    repository: HistoryRewritePreviewSource | null,
): asserts repository is HistoryRewritePreviewSource {
    if (!repository) throw new Error("Open a repository first");
}
