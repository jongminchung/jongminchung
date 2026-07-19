import type {
    DependentRefImpact,
    HistoryRewritePreview,
    PushPreview,
    PushPreviewCommit,
    RebasePlanEntry,
} from "../../../src/generated";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { GitProcessOutcome, GitProcessRunnerLike } from "./git-process";
import { detectInProgressOperation } from "./repository-inspection-service";
import type { RepositoryRegistry } from "./repository-registry";
import { safeErrorMessage } from "./redaction";
import { validateRevision } from "./validation";

const MAX_PREVIEW_COMMITS = 200;
const MAX_REWRITE_COMMITS = 500;

function outputText(
    outcome: GitProcessOutcome,
    stream: "stdout" | "stderr",
): string {
    return outcome.output
        .filter((entry) => entry.stream === stream)
        .map((entry) => entry.data)
        .join("");
}

function invalid(message: string): GitUtilityError {
    return new GitUtilityError("invalidInput", message);
}

function validateRefName(value: string, field: string): void {
    const invalidShape =
        value.length === 0 ||
        value.length > 512 ||
        /^[./-]/u.test(value) ||
        /[./]$/u.test(value) ||
        value.endsWith(".lock") ||
        value.includes("..") ||
        value.includes("@{") ||
        value.includes("//") ||
        Array.from(value).some((character) => {
            const codePoint = character.codePointAt(0) ?? 0;
            return (
                codePoint <= 0x20 ||
                codePoint === 0x7f ||
                "~^:?*[\\".includes(character)
            );
        });
    if (invalidShape) throw invalid(`${field} is not a safe Git ref name`);
}

function validateRemote(value: string): void {
    validateRefName(value, "Remote");
    if (value.includes("/"))
        throw invalid("Remote must be a single ref component");
}

function validateRemoteRef(value: string): void {
    validateRefName(value, "Remote ref");
    if (!value.startsWith("refs/heads/")) {
        throw invalid("Remote ref must be a full refs/heads branch name");
    }
}

function validateObjectId(value: string, field: string): void {
    if (!/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/u.test(value)) {
        throw invalid(`${field} must be an exact hexadecimal object ID`);
    }
}

function protectedBranch(branch: string): boolean {
    return (
        ["main", "master", "production", "release"].includes(branch) ||
        branch.startsWith("release/")
    );
}

function parseAheadBehind(value: string | null): readonly [number, number] {
    const [ahead = "0", behind = "0"] = value?.trim().split(/\s+/u) ?? [];
    return [Number.parseInt(ahead, 10) || 0, Number.parseInt(behind, 10) || 0];
}

function parsePreviewCommits(output: string): PushPreviewCommit[] {
    return output
        .split("\n")
        .flatMap((line): PushPreviewCommit[] => {
            const separator = line.indexOf("\0");
            if (separator < 0) return [];
            const oid = line.slice(0, separator);
            if (!/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/u.test(oid)) return [];
            return [{ oid, subject: line.slice(separator + 1) }];
        })
        .slice(0, MAX_PREVIEW_COMMITS);
}

export class GitPreviewService {
    readonly #registry: RepositoryRegistry;
    readonly #runner: GitProcessRunnerLike;
    readonly #now: () => number;

    private constructor(
        registry: RepositoryRegistry,
        runner: GitProcessRunnerLike,
        now: () => number,
    ) {
        this.#registry = registry;
        this.#runner = runner;
        this.#now = now;
    }

    static of(
        registry: RepositoryRegistry,
        runner: GitProcessRunnerLike,
        now: () => number = Date.now,
    ): GitPreviewService {
        return new GitPreviewService(registry, runner, now);
    }

    async pushPreview(
        repositoryId: RepositoryId,
        requestedRemote: string | null,
        requestedRemoteRef: string | null,
        localRevision: string,
    ): Promise<PushPreview> {
        validateRevision(localRevision);
        const sourceBranch = this.#trimmed(
            await this.#captureOptional(repositoryId, [
                "symbolic-ref",
                "--quiet",
                "--short",
                "HEAD",
            ]),
        );
        const configuredUpstream = this.#trimmed(
            await this.#captureOptional(repositoryId, [
                "rev-parse",
                "--abbrev-ref",
                "--symbolic-full-name",
                "@{upstream}",
            ]),
        );
        const upstreamSeparator = configuredUpstream?.indexOf("/") ?? -1;
        const upstreamRemote =
            configuredUpstream !== null && upstreamSeparator > 0
                ? configuredUpstream.slice(0, upstreamSeparator)
                : null;
        const upstreamBranch =
            configuredUpstream !== null && upstreamSeparator > 0
                ? configuredUpstream.slice(upstreamSeparator + 1)
                : null;
        const remote = requestedRemote ?? upstreamRemote ?? "origin";
        validateRemote(remote);
        const remoteRef =
            requestedRemoteRef ??
            (upstreamBranch === null ? null : `refs/heads/${upstreamBranch}`) ??
            (sourceBranch === null ? null : `refs/heads/${sourceBranch}`);
        if (remoteRef === null) {
            throw invalid("A destination branch is required for detached HEAD");
        }
        validateRemoteRef(remoteRef);

        const localOid = (
            await this.#capture(repositoryId, [
                "rev-parse",
                "--verify",
                "--end-of-options",
                localRevision,
            ])
        ).trim();
        validateObjectId(localOid, "Local revision");
        const checkedAtMs = Math.max(0, Math.trunc(this.#now()));

        const repository = this.#registry.get(repositoryId);
        const remoteOutcome = await this.#runner.run({
            cwd: repository.path,
            args: ["ls-remote", "--heads", "--", remote, remoteRef],
        });
        let remoteOid: string | null = null;
        let remoteStateError: string | null = null;
        if (remoteOutcome.kind === "completed") {
            remoteOid =
                outputText(remoteOutcome, "stdout").trim().split(/\s+/u)[0] ||
                null;
        } else if (
            remoteOutcome.kind === "cancelled" &&
            remoteOutcome.reason === "timeout"
        ) {
            remoteStateError =
                "Remote state could not be verified. Check connectivity and try again.";
        } else {
            remoteStateError =
                "Remote state could not be verified. Check authentication or connectivity.";
        }
        if (remoteOid !== null) validateObjectId(remoteOid, "Remote object ID");

        const remoteObjectAvailable =
            remoteOid !== null &&
            (await this.#succeeds(repositoryId, [
                "cat-file",
                "-e",
                `${remoteOid}^{commit}`,
            ]));
        const fastForward =
            remoteOid === null
                ? true
                : remoteObjectAvailable
                  ? await this.#succeeds(repositoryId, [
                        "merge-base",
                        "--is-ancestor",
                        remoteOid,
                        localOid,
                    ])
                  : null;
        const [ahead, behind] =
            remoteOid !== null && remoteObjectAvailable
                ? parseAheadBehind(
                      await this.#captureOptional(repositoryId, [
                          "rev-list",
                          "--left-right",
                          "--count",
                          "--end-of-options",
                          `${localOid}...${remoteOid}`,
                      ]),
                  )
                : ([0, 0] as const);
        const commitsRange =
            remoteOid !== null && remoteObjectAvailable
                ? `${remoteOid}..${localOid}`
                : localOid;
        const commits = await this.#previewCommits(repositoryId, commitsRange);
        const remoteOnlyCommits =
            remoteOid !== null && remoteObjectAvailable
                ? await this.#previewCommits(
                      repositoryId,
                      `${localOid}..${remoteOid}`,
                  )
                : [];

        const destinationBranch = remoteRef.slice("refs/heads/".length);
        const expectedUpstream = `${remote}/${destinationBranch}`;
        const upstreamConfigured = configuredUpstream === expectedUpstream;
        const isProtected = protectedBranch(destinationBranch);
        const warnings: string[] = [];
        if (remoteOid !== null && !remoteObjectAvailable) {
            warnings.push(
                "Fetch before force-pushing so remote-only commits can be reviewed locally.",
            );
        }
        if (fastForward === false) {
            warnings.push(
                "The destination is not a fast-forward. Normal push is disabled.",
            );
        }
        if (isProtected) {
            warnings.push(
                "This destination is commonly protected and requires branch-name confirmation for force push.",
            );
        }
        return {
            sourceBranch,
            sourceRevision: localRevision,
            localOid,
            remote,
            remoteRef,
            upstreamConfigured,
            setUpstreamDefault: !upstreamConfigured,
            remoteOid,
            expectedLeaseOid: remoteOid,
            ahead,
            behind,
            fastForward,
            newBranch: remoteOid === null && remoteStateError === null,
            commits,
            remoteOnlyCommits,
            protectedBranch: isProtected,
            checkedAtMs,
            remoteStateError,
            warnings,
        };
    }

    async historyRewritePreview(
        repositoryId: RepositoryId,
        fromRevision: string,
    ): Promise<HistoryRewritePreview> {
        validateRevision(fromRevision);
        const repository = this.#registry.get(repositoryId);
        if (
            (await detectInProgressOperation(
                repository.gitDirectory,
                repository.commonDirectory,
            )) !== null
        ) {
            throw invalid(
                "Finish or abort the current Git operation before rewriting history",
            );
        }
        const branch = this.#trimmed(
            await this.#captureOptional(repositoryId, [
                "symbolic-ref",
                "--quiet",
                "--short",
                "HEAD",
            ]),
        );
        if (branch === null)
            throw invalid("History rewrite requires an attached branch");
        const headOid = (
            await this.#capture(repositoryId, ["rev-parse", "--verify", "HEAD"])
        ).trim();
        validateObjectId(headOid, "HEAD");
        if (
            !(await this.#succeeds(repositoryId, [
                "merge-base",
                "--is-ancestor",
                fromRevision,
                "HEAD",
            ]))
        ) {
            throw invalid(
                "From revision must belong to the current branch history",
            );
        }
        const base = this.#trimmed(
            await this.#captureOptional(repositoryId, [
                "rev-parse",
                "--verify",
                "--end-of-options",
                `${fromRevision}^`,
            ]),
        );
        const range = base === null ? "HEAD" : `${base}..HEAD`;
        const history = await this.#capture(repositoryId, [
            "log",
            "--reverse",
            "--topo-order",
            `--max-count=${MAX_REWRITE_COMMITS}`,
            "--format=%x1e%H%x00%P%x00%s",
            "--end-of-options",
            range,
        ]);
        const upstream = this.#trimmed(
            await this.#captureOptional(repositoryId, [
                "rev-parse",
                "--verify",
                "@{upstream}",
            ]),
        );
        const entries: RebasePlanEntry[] = [];
        for (const rawRecord of history.split("\x1e")) {
            const record = rawRecord.trim();
            if (record.length === 0) continue;
            const [oid = "", parentsText = "", subject = ""] = record.split(
                "\0",
                3,
            );
            validateObjectId(oid, "Rewrite commit");
            const parents = parentsText.split(/\s+/u).filter(Boolean);
            const published =
                upstream !== null &&
                (await this.#succeeds(repositoryId, [
                    "merge-base",
                    "--is-ancestor",
                    oid,
                    upstream,
                ]));
            entries.push({
                oid,
                subject,
                parents,
                action: "pick",
                message: null,
                published,
                mergeCommit: parents.length > 1,
            });
        }
        if (entries.length === 0)
            throw invalid("From revision did not produce a rewrite range");

        const refs = await this.#capture(repositoryId, [
            "for-each-ref",
            `--contains=${fromRevision}`,
            "--format=%(refname)%00%(objectname)",
            "refs/heads",
        ]);
        const currentRef = `refs/heads/${branch}`;
        const dependentRefs: DependentRefImpact[] = refs
            .split("\n")
            .flatMap((line) => {
                const separator = line.indexOf("\0");
                if (separator < 0) return [];
                const name = line.slice(0, separator);
                const oid = line.slice(separator + 1);
                if (name === currentRef) return [];
                validateObjectId(oid, "Dependent ref");
                return [{ name, oid }];
            });
        const publishedCommitCount = entries.filter(
            (entry) => entry.published,
        ).length;
        const hasMerges = entries.some((entry) => entry.mergeCommit);
        const isProtected = protectedBranch(branch);
        const warnings: string[] = [];
        if (publishedCommitCount > 0) {
            warnings.push(
                `${publishedCommitCount} published commit(s) will receive new object IDs; pushing later requires explicit review.`,
            );
        }
        if (hasMerges) {
            warnings.push(
                "Merge topology will be preserved with --rebase-merges; merge commits cannot be squashed or reordered.",
            );
        }
        if (dependentRefs.length > 0) {
            warnings.push(
                `${dependentRefs.length} dependent local ref(s) may need updating.`,
            );
        }
        if (isProtected) {
            warnings.push(
                "The current branch is commonly protected. Rewriting is local only; any later push requires explicit confirmation.",
            );
        }
        return {
            branch,
            headOid,
            base,
            root: base === null,
            entries,
            publishedCommitCount,
            descendantCount: entries.length,
            dependentRefs,
            hasMerges,
            protectedBranch: isProtected,
            warnings,
        };
    }

    async #previewCommits(
        repositoryId: RepositoryId,
        revision: string,
    ): Promise<PushPreviewCommit[]> {
        const output = await this.#captureOptional(repositoryId, [
            "log",
            `--max-count=${MAX_PREVIEW_COMMITS}`,
            "--format=%H%x00%s",
            "--end-of-options",
            revision,
        ]);
        return parsePreviewCommits(output ?? "");
    }

    async #capture(
        repositoryId: RepositoryId,
        args: readonly string[],
    ): Promise<string> {
        const repository = this.#registry.get(repositoryId);
        const outcome = await this.#runner.run({ cwd: repository.path, args });
        if (outcome.kind === "completed") return outputText(outcome, "stdout");
        if (outcome.kind === "cancelled") {
            throw new GitUtilityError(
                "commandFailed",
                `Git command was cancelled (${outcome.reason})`,
            );
        }
        const stderr = outputText(outcome, "stderr");
        throw new GitUtilityError(
            outcome.code,
            safeErrorMessage(stderr || outcome.message),
            outcome.exitCode,
        );
    }

    async #captureOptional(
        repositoryId: RepositoryId,
        args: readonly string[],
    ): Promise<string | null> {
        const repository = this.#registry.get(repositoryId);
        const outcome = await this.#runner.run({ cwd: repository.path, args });
        return outcome.kind === "completed"
            ? outputText(outcome, "stdout")
            : null;
    }

    async #succeeds(
        repositoryId: RepositoryId,
        args: readonly string[],
    ): Promise<boolean> {
        const repository = this.#registry.get(repositoryId);
        return (
            (await this.#runner.run({ cwd: repository.path, args })).kind ===
            "completed"
        );
    }

    #trimmed(value: string | null): string | null {
        const trimmed = value?.trim() ?? "";
        return trimmed.length === 0 ? null : trimmed;
    }
}
