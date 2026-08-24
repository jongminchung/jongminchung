import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import {
  useRepositoryEditorCapability,
  useRepositoryToolWindowCapability,
} from "../RepositoryWorkspaceFeatureContext";
import { RepositoryToolStripe } from "./RepositoryChrome";

export function RepositoryToolStripeFeature() {
  const { safeMode } = useRepositoryEditorCapability();
  const {
    bookmarksOpen,
    projectOpen,
    repository,
    repositoryViewMode,
    setBookmarksOpen,
    setProjectOpen,
    setRepositoryViewMode,
    terminalFocused,
  } = useRepositoryToolWindowCapability();

  return (
    <RepositoryToolStripe
      bookmarksOpen={bookmarksOpen}
      changes={repository.status.changes.length}
      mode={repositoryViewMode}
      onModeChange={(mode) => {
        if (mode === "changes") {
          setProjectOpen(false);
          setBookmarksOpen(false);
          setRepositoryViewMode((current) =>
            current === "changes" ? "history" : "changes",
          );
          return;
        }
        setRepositoryViewMode("history");
      }}
      onOpenGitConsole={() =>
        dispatchWorkbenchEvent("git-client:open-git-console", undefined)
      }
      onOpenBookmarks={() => {
        setRepositoryViewMode("history");
        setProjectOpen(false);
        setBookmarksOpen((value) => !value);
      }}
      onOpenProject={() => {
        if (repositoryViewMode === "changes") {
          setRepositoryViewMode("history");
          setProjectOpen(true);
          setBookmarksOpen(false);
          return;
        }
        if (bookmarksOpen) {
          setBookmarksOpen(false);
          setProjectOpen(true);
          return;
        }
        setProjectOpen((value) => !value);
      }}
      projectOpen={projectOpen && repositoryViewMode === "history"}
      readOnly={safeMode}
      terminalFocused={terminalFocused}
    />
  );
}
