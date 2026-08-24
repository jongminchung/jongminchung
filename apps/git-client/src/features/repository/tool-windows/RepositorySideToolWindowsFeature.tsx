import { BookmarksToolWindow } from "../../../components/BookmarksToolWindow";
import { ProjectToolWindow } from "../../../components/ProjectToolWindow";
import {
  createBookmarkGroup,
  deleteBookmarkGroup,
  describeBookmark,
  moveBookmark,
  removeBookmark,
  renameBookmarkGroup,
  setDefaultBookmarkGroup,
} from "../../../domain/bookmarks";
import { toVoidHandler } from "../../../domain/toVoidHandler";
import {
  MAX_SIDE_TOOL_WINDOW_WIDTH,
  MIN_SIDE_TOOL_WINDOW_WIDTH,
} from "../../../domain/workspacePersistence";
import {
  useRepositoryEditorCapability,
  useRepositoryToolWindowCapability,
} from "../RepositoryWorkspaceFeatureContext";

export function RepositorySideToolWindowsFeature() {
  const editor = useRepositoryEditorCapability();
  const toolWindows = useRepositoryToolWindowCapability();
  const {
    bookmarks,
    bookmarksOpen,
    dialog,
    inspector,
    openInspector,
    openLineBookmark,
    openScratchFile,
    projectOpen,
    repository,
    repositoryViewMode,
    scratchFiles,
    sessionLoadTree,
    sessionWriteWorkingTreeFile,
    setBookmarks,
    setBookmarksOpen,
    setProjectOpen,
    setScratchFileChooserOpen,
    setSideToolWindowWidth,
    setToast,
    sideToolWindowWidth,
  } = { ...editor, ...toolWindows };

  return (
    <>
      {bookmarksOpen && repositoryViewMode === "history" && (
        <BookmarksToolWindow
          onClose={() => setBookmarksOpen(false)}
          onCreateGroup={(name, isDefault) =>
            setBookmarks((current) =>
              createBookmarkGroup(
                current,
                crypto.randomUUID(),
                name,
                isDefault,
              ),
            )
          }
          onDeleteBookmark={(bookmarkId) =>
            setBookmarks((current) => removeBookmark(current, bookmarkId))
          }
          onDeleteGroup={(group) => {
            void dialog
              .confirm({
                title: "Delete Bookmark List",
                description: `Are you sure you want to delete ‘${group.name}’ bookmark list? This action can't be undone.`,
                impact: `${group.bookmarks.length} bookmark${group.bookmarks.length === 1 ? "" : "s"} will be deleted.`,
                confirmLabel: "Delete",
                dangerous: true,
              })
              .then((accepted) => {
                if (accepted) {
                  setBookmarks((current) =>
                    deleteBookmarkGroup(current, group.id),
                  );
                }
              });
          }}
          onDescribeBookmark={(bookmarkId, description) =>
            setBookmarks((current) =>
              describeBookmark(current, bookmarkId, description),
            )
          }
          onMoveBookmark={(bookmarkId, offset) =>
            setBookmarks((current) => moveBookmark(current, bookmarkId, offset))
          }
          onOpenBookmark={openLineBookmark}
          onRenameGroup={(groupId, name) =>
            setBookmarks((current) =>
              renameBookmarkGroup(current, groupId, name),
            )
          }
          onSetDefaultGroup={(groupId) =>
            setBookmarks((current) => setDefaultBookmarkGroup(current, groupId))
          }
          onViewOptionsChange={(view) =>
            setBookmarks((current) => ({
              ...current,
              view,
            }))
          }
          state={bookmarks}
        />
      )}
      {projectOpen && repositoryViewMode === "history" && (
        <ProjectToolWindow
          activePath={inspector?.path}
          changes={repository.status.changes}
          hasCommits={repository.snapshot.hasCommits}
          loadTree={sessionLoadTree}
          onClose={() => setProjectOpen(false)}
          onNew={toVoidHandler(async () => {
            const path = await dialog.input({
              title: "New File",
              label: "Path relative to the project",
              placeholder: "src/new-file.ts",
              confirmLabel: "Create",
            });
            if (!path) return;
            try {
              await sessionWriteWorkingTreeFile(path, "");
              openInspector({
                revision: repository.snapshot.headOid ?? "HEAD",
                source: {
                  kind: "workingTree",
                },
                path,
                tab: "file",
              });
            } catch (error) {
              setToast(error instanceof Error ? error.message : String(error));
            }
          })}
          onNewScratch={() => setScratchFileChooserOpen(true)}
          onOpenFile={(path, keepOpen = true) =>
            openInspector(
              {
                revision: repository.snapshot.headOid ?? "HEAD",
                source: {
                  kind: "workingTree",
                },
                path,
                tab: "file",
              },
              keepOpen,
            )
          }
          onOpenScratch={openScratchFile}
          repositoryName={repository.snapshot.name}
          repositoryPath={repository.snapshot.path}
          scratches={scratchFiles}
          width={sideToolWindowWidth}
          onWidthChange={(width) =>
            setSideToolWindowWidth(
              Math.min(
                MAX_SIDE_TOOL_WINDOW_WIDTH,
                Math.max(MIN_SIDE_TOOL_WINDOW_WIDTH, Math.round(width)),
              ),
            )
          }
        />
      )}
    </>
  );
}
