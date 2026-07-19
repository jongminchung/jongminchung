import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { GitOperation, RebasePlanEntry } from "../src/generated";
import type { DesktopApi } from "../src/shared/contracts/ipc";
import { VALID_GIT_OPERATIONS } from "../src/shared/contracts/git-operation-fixtures";
import {
    launchPackaged,
    resetQaProfile,
    runtimeProfileName,
} from "./packaged-app-harness";

const GIT_ENVIRONMENT = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    TZ: "UTC",
};

function git(cwd: string, ...args: readonly string[]): string {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        env: GIT_ENVIRONMENT,
        shell: false,
    });
    if (result.status !== 0) {
        throw new Error(
            result.stderr || result.stdout || `git ${args.join(" ")} failed`,
        );
    }
    return result.stdout;
}

async function createRepository(
    parent: string,
    name: string,
): Promise<string> {
    const repository = join(parent, name);
    await mkdir(repository);
    git(repository, "init", "--initial-branch=main");
    git(repository, "config", "user.name", "Git Client QA");
    git(repository, "config", "user.email", "qa@example.invalid");
    git(repository, "config", "commit.gpgsign", "false");
    await writeFile(join(repository, "tracked.txt"), "baseline\n", "utf8");
    git(repository, "add", "tracked.txt");
    git(repository, "commit", "-m", "baseline");
    return repository;
}

async function commitFile(
    repository: string,
    path: string,
    content: string,
    subject: string,
): Promise<string> {
    await writeFile(join(repository, path), content, "utf8");
    git(repository, "add", "--", path);
    git(repository, "commit", "-m", subject);
    return git(repository, "rev-parse", "HEAD").trim();
}

function rebaseEntry(
    oid: string,
    subject: string,
    action: RebasePlanEntry["action"] = "pick",
    message: string | null = null,
): RebasePlanEntry {
    return {
        oid,
        subject,
        parents: [],
        action,
        message,
        published: false,
        mergeCommit: false,
    };
}

async function openRepository(page: Page, path: string): Promise<string> {
    return page.evaluate(async (repositoryPath) => {
        const desktopWindow = window as typeof window & {
            readonly gitClient?: DesktopApi;
        };
        const api = desktopWindow.gitClient;
        if (api === undefined)
            throw new Error("Electron preload API is unavailable");
        return (await api.git.openRepository(repositoryPath)).id;
    }, path);
}

async function executeOperation(
    page: Page,
    repositoryId: string,
    operation: GitOperation,
): Promise<readonly string[]> {
    return page.evaluate(
        async ({ id, gitOperation }) => {
            const desktopWindow = window as typeof window & {
                readonly gitClient?: DesktopApi;
            };
            const api = desktopWindow.gitClient;
            if (api === undefined)
                throw new Error("Electron preload API is unavailable");
            const events: string[] = [];
            const terminal = await api.git.executeQuery(
                {
                    kind: "operation",
                    operation: gitOperation,
                    repositoryId: id,
                    requestId: crypto.randomUUID(),
                },
                (event) => events.push(event.kind),
            );
            if (terminal.kind !== "completed") {
                throw new Error(
                    terminal.kind === "failed"
                        ? terminal.message
                        : `${gitOperation.kind} ended as ${terminal.kind}`,
                );
            }
            return events;
        },
        { id: repositoryId, gitOperation: operation },
    );
}

test("executes all 51 packaged Git operation kinds with real disposable effects", async () => {
    test.setTimeout(240_000);
    await resetQaProfile(runtimeProfileName);
    const parent = await mkdtemp(
        join(tmpdir(), "git-client-electron-operation-matrix-"),
    );
    const observedKinds = new Set<GitOperation["kind"]>();
    const app = await launchPackaged(["--qa-isolated-profile"]);

    async function run(
        repositoryId: string,
        operation: GitOperation,
    ): Promise<void> {
        const events = await executeOperation(app.page, repositoryId, operation);
        expect(events[0], operation.kind).toBe("started");
        expect(events.at(-1), operation.kind).toBe("completed");
        expect(
            events.slice(1, -1).every((kind) => kind === "output"),
            operation.kind,
        ).toBe(true);
        observedKinds.add(operation.kind);
    }

    try {
        const repository = await createRepository(parent, "basic");
        const repositoryId = await openRepository(app.page, repository);

        await writeFile(join(repository, "stage.txt"), "stage\n", "utf8");
        await run(repositoryId, { kind: "stage", paths: ["stage.txt"] });
        expect(git(repository, "diff", "--cached", "--name-only")).toContain(
            "stage.txt",
        );
        git(repository, "reset", "--hard", "HEAD");
        git(repository, "clean", "-fd");

        await writeFile(join(repository, "stage-all.txt"), "all\n", "utf8");
        await run(repositoryId, { kind: "stageAll" });
        expect(git(repository, "diff", "--cached", "--name-only")).toContain(
            "stage-all.txt",
        );
        git(repository, "reset", "--hard", "HEAD");
        git(repository, "clean", "-fd");

        await writeFile(join(repository, "tracked.txt"), "tracked update\n", "utf8");
        await run(repositoryId, { kind: "stageTracked" });
        expect(git(repository, "diff", "--cached", "--name-only")).toContain(
            "tracked.txt",
        );
        git(repository, "reset", "--hard", "HEAD");

        await writeFile(join(repository, "intent.txt"), "intent\n", "utf8");
        await run(repositoryId, { kind: "addIntent", paths: ["intent.txt"] });
        expect(git(repository, "status", "--short")).toContain("intent.txt");
        git(repository, "reset", "--hard", "HEAD");
        git(repository, "clean", "-fd");

        await writeFile(join(repository, "unstage.txt"), "unstage\n", "utf8");
        git(repository, "add", "unstage.txt");
        await run(repositoryId, { kind: "unstage", paths: ["unstage.txt"] });
        expect(git(repository, "status", "--short")).toContain("?? unstage.txt");
        git(repository, "clean", "-fd");

        await writeFile(join(repository, "cached.txt"), "cached\n", "utf8");
        git(repository, "add", "cached.txt");
        git(repository, "commit", "-m", "add cached fixture");
        await run(repositoryId, {
            kind: "removeCached",
            paths: ["cached.txt"],
        });
        expect(git(repository, "status", "--short")).toContain("D  cached.txt");
        expect(git(repository, "status", "--short")).toContain("?? cached.txt");
        git(repository, "reset", "--hard", "HEAD");

        await writeFile(join(repository, "tracked.txt"), "discarded\n", "utf8");
        await run(repositoryId, { kind: "discard", paths: ["tracked.txt"] });
        expect(await readFile(join(repository, "tracked.txt"), "utf8")).toBe(
            "baseline\n",
        );

        await writeFile(join(repository, "tracked.txt"), "apply patch\n", "utf8");
        const patch = git(repository, "diff", "--", "tracked.txt");
        git(repository, "restore", "--", "tracked.txt");
        await run(repositoryId, {
            kind: "applyPatch",
            patch,
            cached: false,
            reverse: false,
        });
        expect(await readFile(join(repository, "tracked.txt"), "utf8")).toBe(
            "apply patch\n",
        );
        git(repository, "restore", "--", "tracked.txt");

        await writeFile(join(repository, "tracked.txt"), "partial patch\n", "utf8");
        const partialPatch = git(
            repository,
            "diff",
            "--unified=0",
            "--",
            "tracked.txt",
        );
        git(repository, "restore", "--", "tracked.txt");
        await run(repositoryId, {
            kind: "partialPatch",
            patch: partialPatch,
            cached: false,
            reverse: false,
        });
        expect(await readFile(join(repository, "tracked.txt"), "utf8")).toBe(
            "partial patch\n",
        );
        git(repository, "restore", "--", "tracked.txt");

        await writeFile(join(repository, "commit.txt"), "commit\n", "utf8");
        git(repository, "add", "commit.txt");
        await run(repositoryId, {
            kind: "commit",
            message: "packaged commit operation",
            amend: false,
            signOff: false,
            gpgSign: false,
        });
        expect(git(repository, "log", "-1", "--format=%s").trim()).toBe(
            "packaged commit operation",
        );

        await writeFile(join(repository, "tracked.txt"), "advanced\n", "utf8");
        await run(repositoryId, {
            kind: "commitAdvanced",
            message: "packaged advanced commit",
            amend: false,
            signOff: true,
            gpgSign: false,
            skipHooks: true,
            commitAll: true,
        });
        expect(git(repository, "log", "-1", "--format=%s").trim()).toBe(
            "packaged advanced commit",
        );
        expect(git(repository, "log", "-1", "--format=%B")).toContain(
            "Signed-off-by: Git Client QA <qa@example.invalid>",
        );

        const remote = join(parent, "remote.git");
        await mkdir(remote);
        git(remote, "init", "--bare", "--initial-branch=main");
        git(repository, "remote", "add", "origin", remote);
        git(repository, "push", "--set-upstream", "origin", "main");
        const peer = join(parent, "peer");
        git(parent, "clone", remote, peer);
        git(peer, "config", "user.name", "Git Client QA Peer");
        git(peer, "config", "user.email", "peer@example.invalid");
        git(peer, "switch", "-c", "remote-feature");
        await writeFile(join(peer, "remote.txt"), "remote\n", "utf8");
        git(peer, "add", "remote.txt");
        git(peer, "commit", "-m", "remote feature");
        git(peer, "push", "--set-upstream", "origin", "remote-feature");

        await run(repositoryId, { kind: "fetch", remote: "origin", prune: true });
        expect(git(repository, "branch", "--remotes")).toContain(
            "origin/remote-feature",
        );

        git(peer, "switch", "main");
        await writeFile(join(peer, "pulled.txt"), "pull\n", "utf8");
        git(peer, "add", "pulled.txt");
        git(peer, "commit", "-m", "remote main update");
        git(peer, "push", "origin", "main");
        await run(repositoryId, { kind: "pull", rebase: true });
        expect(git(repository, "log", "-1", "--format=%s").trim()).toBe(
            "remote main update",
        );

        await writeFile(join(repository, "pushed.txt"), "push\n", "utf8");
        git(repository, "add", "pushed.txt");
        git(repository, "commit", "-m", "local push update");
        await run(repositoryId, {
            kind: "push",
            destination: {
                remote: "origin",
                remoteRef: "refs/heads/main",
                localRevision: "HEAD",
                setUpstream: true,
            },
            mode: { kind: "normal" },
        });
        expect(git(remote, "rev-parse", "refs/heads/main").trim()).toBe(
            git(repository, "rev-parse", "HEAD").trim(),
        );

        await run(repositoryId, {
            kind: "createBranch",
            name: "operation-branch",
            startPoint: "HEAD",
            checkout: false,
        });
        await run(repositoryId, {
            kind: "renameBranch",
            oldName: "operation-branch",
            newName: "operation-renamed",
        });
        expect(git(repository, "branch", "--list", "operation-renamed")).toContain(
            "operation-renamed",
        );
        await run(repositoryId, {
            kind: "deleteBranch",
            name: "operation-renamed",
            force: false,
        });
        expect(git(repository, "branch", "--list", "operation-renamed")).toBe(
            "",
        );

        await run(repositoryId, {
            kind: "setUpstream",
            branch: "main",
            upstream: "origin/main",
        });
        expect(git(repository, "rev-parse", "--abbrev-ref", "main@{upstream}").trim()).toBe(
            "origin/main",
        );

        git(repository, "push", "origin", "HEAD:refs/heads/delete-me");
        await run(repositoryId, {
            kind: "deleteRemoteBranch",
            remote: "origin",
            branch: "delete-me",
        });
        expect(git(remote, "branch", "--list", "delete-me")).toBe("");

        git(repository, "branch", "checkout-target", "HEAD");
        await run(repositoryId, {
            kind: "checkout",
            target: "checkout-target",
            force: false,
        });
        expect(git(repository, "branch", "--show-current").trim()).toBe(
            "checkout-target",
        );
        git(repository, "switch", "main");

        await run(repositoryId, {
            kind: "createTag",
            name: "operation-v1",
            revision: "HEAD",
            message: "packaged release",
        });
        expect(git(repository, "tag", "--list", "operation-v1").trim()).toBe(
            "operation-v1",
        );
        await run(repositoryId, { kind: "deleteTag", name: "operation-v1" });
        expect(git(repository, "tag", "--list", "operation-v1")).toBe("");
        git(repository, "tag", "push-me", "HEAD");
        await run(repositoryId, {
            kind: "pushTag",
            remote: "origin",
            name: "push-me",
        });
        expect(git(remote, "tag", "--list", "push-me").trim()).toBe("push-me");

        const beforeReset = git(repository, "rev-parse", "HEAD").trim();
        await writeFile(join(repository, "reset.txt"), "reset\n", "utf8");
        git(repository, "add", "reset.txt");
        git(repository, "commit", "-m", "reset target");
        await run(repositoryId, {
            kind: "reset",
            revision: "HEAD^",
            mode: "mixed",
        });
        expect(git(repository, "rev-parse", "HEAD").trim()).toBe(beforeReset);
        git(repository, "reset", "--hard", "HEAD");
        git(repository, "clean", "-fd");

        await run(repositoryId, {
            kind: "setConfig",
            key: "gitclient.operationmatrix",
            value: "verified",
        });
        expect(
            git(repository, "config", "--local", "gitclient.operationmatrix").trim(),
        ).toBe("verified");

        const worktreePath = join(parent, "operation worktree");
        await run(repositoryId, {
            kind: "worktreeAdd",
            path: worktreePath,
            branch: "operation-worktree",
            startPoint: "HEAD",
        });
        expect(git(repository, "worktree", "list", "--porcelain")).toContain(
            worktreePath,
        );
        await run(repositoryId, {
            kind: "worktreeRemove",
            path: worktreePath,
            force: false,
        });
        expect(git(repository, "worktree", "list", "--porcelain")).not.toContain(
            worktreePath,
        );

        await run(repositoryId, {
            kind: "remoteAdd",
            name: "backup",
            url: join(parent, "backup.git"),
        });
        await run(repositoryId, {
            kind: "remoteSetUrl",
            name: "backup",
            url: join(parent, "replacement-backup.git"),
        });
        expect(git(repository, "remote", "get-url", "backup").trim()).toBe(
            join(parent, "replacement-backup.git"),
        );
        await run(repositoryId, { kind: "remoteRemove", name: "backup" });
        expect(git(repository, "remote")).not.toContain("backup");

        const revertRepository = await createRepository(parent, "revert");
        const revertOid = await commitFile(
            revertRepository,
            "revert.txt",
            "revert target\n",
            "revert target",
        );
        const revertId = await openRepository(app.page, revertRepository);
        await run(revertId, {
            kind: "revert",
            revisions: [revertOid],
            noCommit: false,
        });
        expect(git(revertRepository, "log", "-1", "--format=%s")).toContain(
            "Revert",
        );

        const cherryRepository = await createRepository(parent, "cherry-pick");
        git(cherryRepository, "switch", "-c", "source");
        const cherryOid = await commitFile(
            cherryRepository,
            "cherry.txt",
            "picked\n",
            "pick target",
        );
        git(cherryRepository, "switch", "main");
        const cherryId = await openRepository(app.page, cherryRepository);
        await run(cherryId, {
            kind: "cherryPick",
            revisions: [cherryOid],
            noCommit: false,
        });
        expect(await readFile(join(cherryRepository, "cherry.txt"), "utf8")).toBe(
            "picked\n",
        );

        const mergeRepository = await createRepository(parent, "merge");
        git(mergeRepository, "switch", "-c", "feature");
        await commitFile(
            mergeRepository,
            "feature.txt",
            "feature\n",
            "feature commit",
        );
        git(mergeRepository, "switch", "main");
        const mergeId = await openRepository(app.page, mergeRepository);
        await run(mergeId, {
            kind: "merge",
            revision: "feature",
            noFf: true,
            squash: false,
        });
        expect(
            git(mergeRepository, "rev-list", "--parents", "-n", "1", "HEAD")
                .trim()
                .split(" "),
        ).toHaveLength(3);

        const rebaseRepository = await createRepository(parent, "rebase");
        git(rebaseRepository, "switch", "-c", "feature");
        await commitFile(
            rebaseRepository,
            "feature.txt",
            "feature\n",
            "feature commit",
        );
        git(rebaseRepository, "switch", "main");
        const mainOid = await commitFile(
            rebaseRepository,
            "main.txt",
            "main\n",
            "main commit",
        );
        const rebaseId = await openRepository(app.page, rebaseRepository);
        await run(rebaseId, {
            kind: "rebase",
            onto: "main",
            branch: "feature",
        });
        expect(
            git(rebaseRepository, "merge-base", "main", "feature").trim(),
        ).toBe(mainOid);

        const interactiveRepository = await createRepository(
            parent,
            "interactive-rebase",
        );
        const interactiveRoot = git(
            interactiveRepository,
            "rev-parse",
            "HEAD",
        ).trim();
        const interactiveSecond = await commitFile(
            interactiveRepository,
            "second.txt",
            "second\n",
            "interactive second",
        );
        const interactiveThird = await commitFile(
            interactiveRepository,
            "third.txt",
            "third\n",
            "interactive third",
        );
        const interactiveId = await openRepository(
            app.page,
            interactiveRepository,
        );
        await run(interactiveId, {
            kind: "interactiveRebase",
            base: null,
            entries: [
                rebaseEntry(interactiveRoot, "baseline"),
                rebaseEntry(
                    interactiveSecond,
                    "interactive second",
                    "reword",
                    "interactive second rewritten",
                ),
                rebaseEntry(interactiveThird, "interactive third"),
            ],
            options: {
                autostash: false,
                updateRefs: false,
                preserveMerges: false,
            },
        });
        expect(git(interactiveRepository, "log", "--format=%s")).toContain(
            "interactive second rewritten",
        );

        const dropRepository = await createRepository(parent, "drop-commits");
        const dropOid = await commitFile(
            dropRepository,
            "drop.txt",
            "drop\n",
            "drop this commit",
        );
        await commitFile(
            dropRepository,
            "keep.txt",
            "keep\n",
            "keep after drop",
        );
        const dropId = await openRepository(app.page, dropRepository);
        await run(dropId, { kind: "dropCommits", revisions: [dropOid] });
        expect(git(dropRepository, "log", "--format=%s")).not.toContain(
            "drop this commit",
        );

        const squashRepository = await createRepository(
            parent,
            "squash-commits",
        );
        const squashSecond = await commitFile(
            squashRepository,
            "squash-second.txt",
            "second\n",
            "squash second",
        );
        const squashThird = await commitFile(
            squashRepository,
            "squash-third.txt",
            "third\n",
            "squash third",
        );
        const squashId = await openRepository(app.page, squashRepository);
        await run(squashId, {
            kind: "squashCommits",
            revisions: [squashThird, squashSecond],
        });
        expect(
            Number.parseInt(
                git(squashRepository, "rev-list", "--count", "HEAD").trim(),
                10,
            ),
        ).toBe(2);

        const rewordRepository = await createRepository(parent, "reword");
        const rewordOid = await commitFile(
            rewordRepository,
            "reword.txt",
            "reword\n",
            "old reword subject",
        );
        const rewordId = await openRepository(app.page, rewordRepository);
        await run(rewordId, {
            kind: "rewordCommit",
            revision: rewordOid,
            message: "new reword subject",
        });
        expect(git(rewordRepository, "log", "-1", "--format=%s").trim()).toBe(
            "new reword subject",
        );

        const undoRepository = await createRepository(parent, "undo-commit");
        const undoBase = git(undoRepository, "rev-parse", "HEAD").trim();
        await commitFile(
            undoRepository,
            "undo.txt",
            "undo\n",
            "undo target",
        );
        const undoId = await openRepository(app.page, undoRepository);
        await run(undoId, { kind: "undoCommit" });
        expect(git(undoRepository, "rev-parse", "HEAD").trim()).toBe(undoBase);
        expect(git(undoRepository, "diff", "--cached", "--name-only")).toContain(
            "undo.txt",
        );

        const fixupRepository = await createRepository(parent, "fixup");
        const fixupTarget = git(fixupRepository, "rev-parse", "HEAD").trim();
        await writeFile(join(fixupRepository, "tracked.txt"), "fixup\n", "utf8");
        git(fixupRepository, "add", "tracked.txt");
        const fixupId = await openRepository(app.page, fixupRepository);
        await run(fixupId, {
            kind: "createFixupCommit",
            revision: fixupTarget,
        });
        expect(git(fixupRepository, "log", "-1", "--format=%s")).toContain(
            "fixup! baseline",
        );

        const squashCommitRepository = await createRepository(
            parent,
            "squash-commit",
        );
        const squashTarget = git(
            squashCommitRepository,
            "rev-parse",
            "HEAD",
        ).trim();
        await writeFile(
            join(squashCommitRepository, "tracked.txt"),
            "squash commit\n",
            "utf8",
        );
        git(squashCommitRepository, "add", "tracked.txt");
        const squashCommitId = await openRepository(
            app.page,
            squashCommitRepository,
        );
        await run(squashCommitId, {
            kind: "createSquashCommit",
            revision: squashTarget,
        });
        expect(
            git(squashCommitRepository, "log", "-1", "--format=%s"),
        ).toContain("squash! baseline");

        const continueRepository = await createRepository(parent, "continue");
        git(continueRepository, "config", "core.editor", "true");
        git(continueRepository, "switch", "-c", "topic");
        await writeFile(
            join(continueRepository, "tracked.txt"),
            "topic\n",
            "utf8",
        );
        git(continueRepository, "commit", "-am", "topic change");
        git(continueRepository, "switch", "main");
        await writeFile(
            join(continueRepository, "tracked.txt"),
            "main\n",
            "utf8",
        );
        git(continueRepository, "commit", "-am", "main change");
        git(continueRepository, "switch", "topic");
        expect(() => git(continueRepository, "rebase", "main")).toThrow();
        await writeFile(
            join(continueRepository, "tracked.txt"),
            "continued\n",
            "utf8",
        );
        git(continueRepository, "add", "tracked.txt");
        const continueId = await openRepository(app.page, continueRepository);
        await run(continueId, { kind: "continue", operation: "rebase" });
        expect(git(continueRepository, "status", "--porcelain")).toBe("");

        const skipRepository = await createRepository(parent, "skip");
        git(skipRepository, "switch", "-c", "source");
        await writeFile(join(skipRepository, "tracked.txt"), "source\n", "utf8");
        git(skipRepository, "commit", "-am", "source conflict");
        const skipOid = git(skipRepository, "rev-parse", "HEAD").trim();
        git(skipRepository, "switch", "main");
        await writeFile(join(skipRepository, "tracked.txt"), "main\n", "utf8");
        git(skipRepository, "commit", "-am", "main conflict");
        expect(() => git(skipRepository, "cherry-pick", skipOid)).toThrow();
        const skipId = await openRepository(app.page, skipRepository);
        await run(skipId, { kind: "skip", operation: "cherryPick" });
        expect(git(skipRepository, "status", "--porcelain")).toBe("");
        expect(await readFile(join(skipRepository, "tracked.txt"), "utf8")).toBe(
            "main\n",
        );

        const abortRepository = await createRepository(parent, "abort");
        git(abortRepository, "switch", "-c", "source");
        await writeFile(join(abortRepository, "tracked.txt"), "source\n", "utf8");
        git(abortRepository, "commit", "-am", "source conflict");
        git(abortRepository, "switch", "main");
        await writeFile(join(abortRepository, "tracked.txt"), "main\n", "utf8");
        git(abortRepository, "commit", "-am", "main conflict");
        expect(() => git(abortRepository, "merge", "source")).toThrow();
        const abortId = await openRepository(app.page, abortRepository);
        await run(abortId, { kind: "abort", operation: "merge" });
        expect(git(abortRepository, "status", "--porcelain")).toBe("");
        expect(await readFile(join(abortRepository, "tracked.txt"), "utf8")).toBe(
            "main\n",
        );

        const stashRepository = await createRepository(parent, "stash");
        const stashId = await openRepository(app.page, stashRepository);
        await writeFile(join(stashRepository, "tracked.txt"), "stashed\n", "utf8");
        await writeFile(join(stashRepository, "untracked.txt"), "new\n", "utf8");
        await run(stashId, {
            kind: "stashPush",
            message: "operation stash",
            includeUntracked: true,
            keepIndex: false,
        });
        expect(git(stashRepository, "status", "--porcelain")).toBe("");
        await run(stashId, {
            kind: "stashApply",
            stash: "stash@{0}",
            pop: false,
            reinstateIndex: false,
        });
        expect(await readFile(join(stashRepository, "tracked.txt"), "utf8")).toBe(
            "stashed\n",
        );
        git(stashRepository, "reset", "--hard", "HEAD");
        git(stashRepository, "clean", "-fd");
        await run(stashId, { kind: "stashDrop", stash: "stash@{0}" });
        expect(git(stashRepository, "stash", "list")).toBe("");

        for (const [index, content] of ["first", "second"].entries()) {
            await writeFile(
                join(stashRepository, "tracked.txt"),
                `${content}\n`,
                "utf8",
            );
            git(
                stashRepository,
                "stash",
                "push",
                "--message",
                `clear ${index}`,
            );
        }
        await run(stashId, { kind: "stashClear" });
        expect(git(stashRepository, "stash", "list")).toBe("");

        const stashBranchRepository = await createRepository(
            parent,
            "stash-branch",
        );
        await writeFile(
            join(stashBranchRepository, "tracked.txt"),
            "branch stash\n",
            "utf8",
        );
        git(
            stashBranchRepository,
            "stash",
            "push",
            "--message",
            "branch stash",
        );
        const stashBranchId = await openRepository(
            app.page,
            stashBranchRepository,
        );
        await run(stashBranchId, {
            kind: "stashBranch",
            stash: "stash@{0}",
            branch: "from-stash",
        });
        expect(
            git(stashBranchRepository, "branch", "--show-current").trim(),
        ).toBe("from-stash");
        expect(
            await readFile(join(stashBranchRepository, "tracked.txt"), "utf8"),
        ).toBe("branch stash\n");

        const shallowSource = await createRepository(parent, "shallow-source");
        await commitFile(
            shallowSource,
            "second.txt",
            "second\n",
            "second shallow commit",
        );
        await commitFile(
            shallowSource,
            "third.txt",
            "third\n",
            "third shallow commit",
        );
        const shallowRepository = join(parent, "shallow-clone");
        git(
            parent,
            "clone",
            "--depth",
            "1",
            pathToFileURL(shallowSource).href,
            shallowRepository,
        );
        const shallowId = await openRepository(app.page, shallowRepository);
        expect(git(shallowRepository, "rev-parse", "--is-shallow-repository").trim()).toBe(
            "true",
        );
        await run(shallowId, { kind: "unshallow" });
        expect(git(shallowRepository, "rev-parse", "--is-shallow-repository").trim()).toBe(
            "false",
        );
        expect(git(shallowRepository, "rev-list", "--count", "HEAD").trim()).toBe(
            "3",
        );

        const submoduleChild = await createRepository(
            parent,
            "submodule-child",
        );
        const submoduleRepository = await createRepository(
            parent,
            "submodule-root",
        );
        git(
            submoduleRepository,
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            submoduleChild,
            "modules/child",
        );
        git(submoduleRepository, "commit", "-am", "add submodule");
        git(submoduleRepository, "submodule", "deinit", "--force", "--all");
        const submoduleId = await openRepository(app.page, submoduleRepository);
        await run(submoduleId, {
            kind: "updateSubmodules",
            init: true,
            recursive: true,
        });
        expect(
            await readFile(
                join(submoduleRepository, "modules", "child", "tracked.txt"),
                "utf8",
            ),
        ).toBe("baseline\n");

        expect(VALID_GIT_OPERATIONS).toHaveLength(51);
        const expectedKinds = new Set(
            VALID_GIT_OPERATIONS.map(({ kind }) => kind),
        );
        expect(observedKinds.size).toBe(51);
        expect([...observedKinds].sort()).toEqual([...expectedKinds].sort());
    } finally {
        await app.close();
        await rm(parent, { recursive: true, force: true });
    }
});
