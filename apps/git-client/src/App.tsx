import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauriRuntime } from "./bridge/GitBridge";
import { BottomPanel } from "./components/BottomPanel";
import { BranchTree } from "./components/BranchTree";
import { CommitContextMenu } from "./components/CommitContextMenu";
import { CommitLog } from "./components/CommitLog";
import { ConflictEditorDialog } from "./components/ConflictEditorDialog";
import { DetailsPane } from "./components/DetailsPane";
import { DiffDialog } from "./components/DiffDialog";
import { Icon } from "./components/Icon";
import { RepositoryDialog } from "./components/RepositoryDialog";
import {
  RepositoryInspectorDialog,
  type InspectorTab,
} from "./components/RepositoryInspectorDialog";
import { RepositoryManagementDialog } from "./components/RepositoryManagementDialog";
import { deriveActionAvailability } from "./domain/actionAvailability";
import { commitUrl } from "./domain/forge";
import { sampleCommitFiles, samplePatch } from "./domain/sampleData";
import type { ActionAvailability, Commit, FileChange, Ref } from "./domain/types";
import type { ConflictContent } from "./generated";
import { useGitSession } from "./hooks/useGitSession";
import styles from "./styles/App.module.css";

interface ContextPosition {
  readonly x: number;
  readonly y: number;
}

interface DiffState {
  readonly file: FileChange;
  readonly patch: string;
  readonly loading: boolean;
  readonly mode: "readOnly" | "stage" | "unstage";
}

interface InspectorState {
  readonly revision: string;
  readonly path?: string;
  readonly tab: InspectorTab;
}

export default function App() {
  const session = useGitSession();
  const { repository } = session;
  const {
    loadBlame,
    loadCommitDiff,
    loadCommitFiles,
    loadFileHistory,
    loadTree,
    loadWorkingDiff,
    readConflict,
  } = session;
  const [selectedOids, setSelectedOids] = useState<readonly string[]>(
    repository.commits[0] ? [repository.commits[0].oid] : [],
  );
  const [selectedRef, setSelectedRef] = useState<string | undefined>(
    repository.refs.find((ref) => ref.current)?.name,
  );
  const [contextPosition, setContextPosition] = useState<ContextPosition>();
  const [diffState, setDiffState] = useState<DiffState>();
  const [conflictContent, setConflictContent] = useState<ConflictContent>();
  const [inspector, setInspector] = useState<InspectorState>();
  const [commitFiles, setCommitFiles] = useState<readonly FileChange[]>(sampleCommitFiles);
  const [commitFilesLoading, setCommitFilesLoading] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [toast, setToast] = useState<string>();
  const [showRepositoryDialog, setShowRepositoryDialog] = useState(() => isTauriRuntime());
  const [showManagement, setShowManagement] = useState(false);
  const commitsByOid = useMemo(
    () => new Map(repository.commits.map((commit) => [commit.oid, commit])),
    [repository.commits],
  );
  const selectedCommits = useMemo(
    () =>
      selectedOids
        .map((oid) => commitsByOid.get(oid))
        .filter((commit): commit is Commit => Boolean(commit)),
    [commitsByOid, selectedOids],
  );
  const primaryCommit = selectedCommits[0];
  const primaryIndex = primaryCommit
    ? repository.commits.findIndex((commit) => commit.oid === primaryCommit.oid)
    : -1;
  const availability = useMemo(
    () =>
      deriveActionAvailability({
        selectedCommits,
        currentBranch: repository.snapshot.currentBranch ?? undefined,
        headOid: repository.snapshot.headOid ?? undefined,
        upstream: repository.snapshot.upstream ?? undefined,
        selectedIsAncestorOfHead: primaryIndex >= 0,
        selectedIsAheadOfUpstream: primaryIndex >= 0 && primaryIndex < repository.status.ahead,
        hasChild: Boolean(
          primaryCommit &&
          repository.commits.some((commit) => commit.parents.includes(primaryCommit.oid)),
        ),
        repositoryHasCommits: repository.snapshot.hasCommits,
        operationInProgress: repository.snapshot.operation !== null,
      }),
    [
      primaryCommit,
      primaryIndex,
      repository.commits,
      repository.snapshot,
      repository.status.ahead,
      selectedCommits,
    ],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (!repository.commits.some((commit) => selectedOids.includes(commit.oid))) {
      setSelectedOids(repository.commits[0] ? [repository.commits[0].oid] : []);
    }
  }, [repository.commits, selectedOids]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 2_800);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!primaryCommit) {
      setCommitFiles([]);
      return;
    }
    if (!isTauriRuntime()) {
      setCommitFiles(sampleCommitFiles);
      return;
    }
    let active = true;
    setCommitFilesLoading(true);
    void loadCommitFiles(primaryCommit.oid)
      .then((files) => {
        if (active) setCommitFiles(files);
      })
      .catch(() => {
        if (active) setCommitFiles([]);
      })
      .finally(() => {
        if (active) setCommitFilesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadCommitFiles, primaryCommit]);

  const openDiff = useCallback(
    (file: FileChange) => {
      if (!primaryCommit || !isTauriRuntime()) {
        setDiffState({ file, patch: samplePatch, loading: false, mode: "readOnly" });
        return;
      }
      setDiffState({ file, patch: "", loading: true, mode: "readOnly" });
      void loadCommitDiff(primaryCommit, file.path)
        .then((patch) => {
          setDiffState((current) =>
            current?.file.path === file.path
              ? { file, patch, loading: false, mode: "readOnly" }
              : current,
          );
        })
        .catch((error) => {
          setDiffState((current) =>
            current?.file.path === file.path
              ? {
                  file,
                  patch: `Unable to load diff: ${String(error)}`,
                  loading: false,
                  mode: "readOnly",
                }
              : current,
          );
        });
    },
    [loadCommitDiff, primaryCommit],
  );

  const openWorkingDiff = useCallback(
    (file: FileChange, staged: boolean) => {
      if (file.status === "conflicted") {
        if (!isTauriRuntime()) {
          setToast("Conflict stages are loaded by the native Git bridge.");
          return;
        }
        void readConflict(file.path)
          .then(setConflictContent)
          .catch((error) => setToast(`Unable to read conflict: ${String(error)}`));
        return;
      }
      const mode = staged ? "unstage" : "stage";
      if (!isTauriRuntime()) {
        setDiffState({ file, patch: samplePatch, loading: false, mode });
        return;
      }
      setDiffState({ file, patch: "", loading: true, mode });
      void loadWorkingDiff(file.path, staged)
        .then((patch) => setDiffState({ file, patch, loading: false, mode }))
        .catch((error) =>
          setDiffState({
            file,
            patch: `Unable to load diff: ${String(error)}`,
            loading: false,
            mode,
          }),
        );
    },
    [loadWorkingDiff, readConflict],
  );

  const selectRelative = useCallback(
    (direction: "parent" | "child") => {
      if (!primaryCommit) return;
      const oid =
        direction === "parent"
          ? primaryCommit.parents[0]
          : repository.commits.find((commit) => commit.parents.includes(primaryCommit.oid))?.oid;
      if (oid && commitsByOid.has(oid)) setSelectedOids([oid]);
    },
    [commitsByOid, primaryCommit, repository.commits],
  );

  const openRepository = useCallback(async () => {
    if (!isTauriRuntime()) {
      setToast(
        "Repository picker is available in the Tauri app. The browser shows the QA fixture.",
      );
      return;
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ directory: true, multiple: false, title: "Open Git Repository" });
    if (typeof path === "string") {
      await session.openRepository(path);
      try {
        const { load } = await import("@tauri-apps/plugin-store");
        const store = await load("settings.json", { autoSave: 200, defaults: {} });
        const recent = (await store.get<string[]>("recentRepositories")) ?? [];
        await store.set(
          "recentRepositories",
          [path, ...recent.filter((item) => item !== path)].slice(0, 12),
        );
      } catch {
        /* Recent repositories are non-critical. */
      }
    }
  }, [session]);

  const runAction = useCallback(
    async (action: keyof ActionAvailability) => {
      setContextPosition(undefined);
      if (!primaryCommit || !availability[action]) return;
      if (action === "copyRevision") {
        await navigator.clipboard.writeText(primaryCommit.oid);
        setToast(`Copied ${primaryCommit.oid.slice(0, 8)}`);
      } else if (action === "goToParent") selectRelative("parent");
      else if (action === "goToChild") selectRelative("child");
      else if (action === "cherryPick")
        await session.executeOperation({
          kind: "cherryPick",
          revisions: selectedCommits.map((commit) => commit.oid),
          noCommit: false,
        });
      else if (action === "revert")
        await session.executeOperation({
          kind: "revert",
          revisions: selectedCommits.map((commit) => commit.oid),
          noCommit: false,
        });
      else if (action === "reset") {
        if (
          window.confirm(
            `Reset ${repository.snapshot.currentBranch} to ${primaryCommit.oid.slice(0, 8)}?\n\nAffected files will be previewed again before a hard reset.`,
          )
        ) {
          await session.executeOperation({
            kind: "reset",
            revision: primaryCommit.oid,
            mode: "mixed",
          });
        }
      } else if (action === "newBranch") {
        const name = window.prompt("New branch name", "feat/");
        if (name)
          await session.executeOperation({
            kind: "createBranch",
            name,
            startPoint: primaryCommit.oid,
            checkout: false,
          });
      } else if (action === "newTag") {
        const name = window.prompt("New tag name", "v0.1.0");
        if (name)
          await session.executeOperation({
            kind: "createTag",
            name,
            revision: primaryCommit.oid,
            message: null,
          });
      } else if (action === "pushUpTo") {
        const remote = (repository.snapshot.upstream ?? "origin/main").split("/")[0] ?? "origin";
        await session.executeOperation({
          kind: "pushTo",
          remote,
          revision: primaryCommit.oid,
          destination: `refs/heads/${repository.snapshot.currentBranch ?? "main"}`,
        });
      } else if (action === "viewInBrowser") {
        const url = repository.snapshot.remoteUrl
          ? commitUrl(repository.snapshot.remoteUrl, primaryCommit.oid)
          : undefined;
        if (!url) setToast("The origin remote is not a supported GitHub or GitLab URL.");
        else if (isTauriRuntime()) {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(url);
        } else window.open(url, "_blank", "noopener,noreferrer");
      } else if (action === "createPatch") {
        await navigator.clipboard.writeText(`git format-patch -1 ${primaryCommit.oid}`);
        setToast("Patch command copied. Native save dialog is available in the app.");
      } else if (action === "showRepositoryAtRevision") {
        setInspector({ revision: primaryCommit.oid, tab: "tree" });
      } else if (action === "compareVersions") {
        setToast("Select a second commit to compare versions.");
      } else if (action === "drop") {
        if (
          window.confirm(
            `Drop ${selectedCommits.length} commit(s) with interactive rebase?\n\nThe current HEAD is retained in Git reflog for recovery.`,
          )
        ) {
          await session.executeOperation({
            kind: "dropCommits",
            revisions: selectedCommits.map((commit) => commit.oid),
          });
        }
      } else if (action === "squash") {
        if (
          window.confirm(
            `Squash ${selectedCommits.length} contiguous commits?\n\nThe combined commit message can be amended after rebase.`,
          )
        ) {
          await session.executeOperation({
            kind: "squashCommits",
            revisions: selectedCommits.map((commit) => commit.oid),
          });
        }
      }
    },
    [availability, primaryCommit, repository.snapshot, selectRelative, selectedCommits, session],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void runAction("copyRevision");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        selectRelative("parent");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectRelative("child");
      } else if (event.key === "Escape") setContextPosition(undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runAction, selectRelative]);

  const selectRef = (ref: Ref) => {
    setSelectedRef(ref.name);
    if (commitsByOid.has(ref.oid)) setSelectedOids([ref.oid]);
  };

  return (
    <div className={styles.appShell} onClick={() => setContextPosition(undefined)}>
      <header className={styles.titlebar} data-tauri-drag-region>
        <div className={styles.trafficSpace} />
        <nav>
          <button className={styles.appTab}>
            <Icon name="commit" size={14} />
            Git
          </button>
          <button className={styles.activeTopTab}>
            Log: {repository.snapshot.currentBranch ?? "HEAD"}
          </button>
          <button>Console</button>
          <button className={styles.closeTab}>×</button>
          <button aria-label="Open new log tab" className={styles.iconButton}>
            <Icon name="plus" size={14} />
          </button>
        </nav>
        <span className={styles.titleRepo}>{repository.snapshot.name}</span>
        <button
          className={styles.iconButton}
          onClick={() => setDark((value) => !value)}
          title="Toggle theme"
        >
          <Icon name={dark ? "sun" : "moon"} size={14} />
        </button>
      </header>
      <div className={styles.commandbar}>
        <button className={styles.repositoryButton} onClick={() => void openRepository()}>
          <span className={styles.repoMark}>
            <Icon name="branch" size={14} />
          </span>
          <span>
            <strong>{repository.snapshot.name}</strong>
            <small>{repository.snapshot.path}</small>
          </span>
          <Icon name="chevron" size={12} />
        </button>
        <span className={styles.commandDivider} />
        <button onClick={() => void session.reload()} title="Refresh">
          <Icon name="refresh" size={15} />
        </button>
        <button
          onClick={() =>
            void session.executeOperation({ kind: "fetch", remote: null, prune: false })
          }
          title="Fetch"
        >
          <Icon name="fetch" size={15} />
          <span>Fetch</span>
        </button>
        <button
          onClick={() => void session.executeOperation({ kind: "pull", rebase: false })}
          title="Pull"
        >
          <Icon name="pull" size={15} />
          <span>Pull</span>
        </button>
        <button
          onClick={() =>
            void session.executeOperation({
              kind: "push",
              remote: null,
              refspec: null,
              forceWithLease: false,
            })
          }
          title="Push"
        >
          <Icon name="push" size={15} />
          <span>Push</span>
          {repository.status.ahead > 0 && <em>{repository.status.ahead}</em>}
        </button>
        <span className={styles.commandDivider} />
        <button>
          <Icon name="branch" size={15} />
          <span>{repository.snapshot.currentBranch ?? "Detached HEAD"}</span>
          <Icon name="chevron" size={11} />
        </button>
        <span />
        {repository.snapshot.isShallow && <span className={styles.statePill}>Shallow</span>}
        {repository.snapshot.isBare && <span className={styles.statePill}>Bare</span>}
        {repository.snapshot.operation && (
          <span className={styles.operationPill}>
            <Icon name="warning" size={13} />
            {repository.snapshot.operation} in progress
          </span>
        )}
        <button
          aria-label="Manage remotes and worktrees"
          className={styles.iconButton}
          onClick={() => setShowManagement(true)}
        >
          <Icon name="more" size={16} />
        </button>
      </div>
      {session.error && (
        <div className={styles.errorBanner}>
          <Icon name="warning" size={14} />
          <span>{session.error}</span>
          <button onClick={() => window.location.reload()}>Dismiss</button>
        </div>
      )}
      <main className={styles.workspace} aria-busy={session.loading}>
        <div className={styles.mainPanes}>
          <BranchTree
            onAdd={() => setShowRepositoryDialog(true)}
            onSelect={selectRef}
            refs={repository.refs}
            selected={selectedRef}
          />
          <CommitLog
            commits={repository.commits}
            onContextMenu={(event, commit) => {
              event.preventDefault();
              event.stopPropagation();
              if (!selectedOids.includes(commit.oid)) setSelectedOids([commit.oid]);
              setContextPosition({ x: event.clientX, y: event.clientY });
            }}
            onSelectionChange={setSelectedOids}
            selectedOids={selectedOids}
          />
          <DetailsPane
            commit={primaryCommit}
            files={commitFiles}
            loading={commitFilesLoading}
            onInspectFile={(file, tab) => {
              if (primaryCommit) {
                setInspector({ revision: primaryCommit.oid, path: file.path, tab });
              }
            }}
            onOpenDiff={openDiff}
            onOpenTree={() => {
              if (primaryCommit) setInspector({ revision: primaryCommit.oid, tab: "tree" });
            }}
          />
        </div>
        <BottomPanel
          changelists={session.changelists}
          collapsed={bottomCollapsed}
          consoleEntries={session.consoleEntries}
          onApplyShelf={(shelfId, drop) => void session.applyShelf(shelfId, drop)}
          onCreateShelf={(message, paths) => void session.createShelf(message, paths)}
          onCommitChangelist={async (changelistId, message, amend) => {
            await session.commitChangelist(changelistId, message, amend);
          }}
          onDeleteChangelist={session.deleteChangelist}
          onDeleteShelf={(shelfId) => void session.deleteShelf(shelfId)}
          onOperation={session.executeOperation}
          onOpenDiff={openWorkingDiff}
          onRestoreRecovery={async (entryId) => {
            await session.restoreRecoveryEntry(entryId);
          }}
          onSaveChangelist={session.saveChangelist}
          onToggle={() => setBottomCollapsed((value) => !value)}
          recoveryEntries={session.recoveryEntries}
          shelves={session.shelves}
          status={repository.status}
        />
        {session.loading && <div className={styles.progressLine} />}
      </main>
      <footer className={styles.statusbar}>
        <span>
          <Icon name="branch" size={12} />
          {repository.snapshot.currentBranch ?? "HEAD"}
        </span>
        <span>
          {repository.status.ahead}↑ {repository.status.behind}↓
        </span>
        <span />
        <span>{repository.snapshot.gitVersion.display}</span>
        <span>UTF-8</span>
        <span>LF</span>
      </footer>
      {contextPosition && (
        <CommitContextMenu
          availability={availability}
          onAction={(action) => void runAction(action)}
          x={contextPosition.x}
          y={contextPosition.y}
        />
      )}
      {diffState && (
        <DiffDialog
          file={diffState.file}
          loading={diffState.loading}
          mode={diffState.mode}
          onApplyPatch={async (patch, cached, reverse) => {
            await session.executeOperation({ kind: "partialPatch", patch, cached, reverse });
            setDiffState(undefined);
          }}
          onClose={() => setDiffState(undefined)}
          patch={diffState.patch}
        />
      )}
      {conflictContent && (
        <ConflictEditorDialog
          content={conflictContent}
          onAbort={async () => {
            const operation = repository.snapshot.operation;
            if (!operation || operation === "bisect") return;
            await session.executeOperation({ kind: "abort", operation });
            setConflictContent(undefined);
          }}
          onClose={() => setConflictContent(undefined)}
          onContinue={async () => {
            const operation = repository.snapshot.operation;
            if (!operation || operation === "bisect") return;
            await session.executeOperation({ kind: "continue", operation });
            setConflictContent(undefined);
          }}
          onResolveBinary={async (side) => {
            await session.resolveBinaryConflict(conflictContent.path, side);
            setConflictContent(undefined);
          }}
          onSave={async (result) => {
            await session.saveConflictResult(conflictContent.path, result, true);
            setConflictContent(undefined);
          }}
          operation={repository.snapshot.operation}
        />
      )}
      {inspector && (
        <RepositoryInspectorDialog
          initialPath={inspector.path}
          initialTab={inspector.tab}
          loadBlame={loadBlame}
          loadFileHistory={loadFileHistory}
          loadTree={loadTree}
          onClose={() => setInspector(undefined)}
          revision={inspector.revision}
        />
      )}
      {showManagement && (
        <RepositoryManagementDialog
          currentRepositoryId={repository.snapshot.id}
          onAddRoot={openRepository}
          onClose={() => setShowManagement(false)}
          onOpenWorktree={async (path) => {
            await session.openRepository(path);
            setShowManagement(false);
          }}
          onOperation={session.executeOperation}
          onRollback={session.applyMultiRootRollback}
          onSwitchRepository={session.switchRepository}
          onSynchronizedOperation={session.executeSynchronizedBranchOperation}
          openRepositories={session.openRepositories}
          remotes={session.remotes}
          worktrees={session.worktrees}
        />
      )}
      {showRepositoryDialog && (
        <RepositoryDialog
          onClone={(url, path, depth) => void session.cloneRepository(url, path, depth)}
          onClose={() => setShowRepositoryDialog(false)}
          onInit={(path, bare) => void session.initializeRepository(path, bare)}
          onOpen={(path) => void session.openRepository(path)}
        />
      )}
      {toast && (
        <div className={styles.toast}>
          <Icon name="check" size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
