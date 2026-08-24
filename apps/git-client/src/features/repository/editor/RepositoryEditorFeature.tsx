import { Button } from "@jongminchung/ui/components/button";
import { TabsContent } from "@jongminchung/ui/components/tabs";
import { cn } from "@jongminchung/ui/lib/utils";
import { EmptyState } from "../../../components/ProductCollections";
import { RepositoryInspectorDialog } from "../../../components/RepositoryInspectorDialog";
import { ScratchEditor } from "../../../components/ScratchEditor";
import { allLineBookmarks } from "../../../domain/bookmarks";
import {
  useRepositoryEditorCapability,
  useRepositoryToolWindowCapability,
} from "../RepositoryWorkspaceFeatureContext";
import { inspectorKey } from "../state/workspaceTypes";
import {
  editorPanelDomId,
  editorTabDomId,
} from "./useRepositoryTabCoordinator";

export function RepositoryEditorFeature() {
  const editor = useRepositoryEditorCapability();
  const toolWindows = useRepositoryToolWindowCapability();
  const {
    bookmarks,
    editorTabsId,
    inspector,
    inspectorTabs,
    logOpen,
    openGitLogTab,
    requestCloseInspector,
    requestToggleBookmark,
    safeMode,
    scratchFiles,
    sessionLoadBlame,
    sessionLoadFileHistory,
    sessionLoadTree,
    sessionOpenWorkingTreeFile,
    sessionReadFile,
    sessionReadFilePreview,
    sessionWriteWorkingTreeFile,
    setInspectorDirty,
    setRepositoryViewMode,
    setScratchFiles,
  } = { ...editor, ...toolWindows };

  return (
    <>
      {!inspector && !logOpen && (
        <EmptyState className="gap-3 p-0 [&_[data-slot=empty-content]]:gap-3 [&_kbd]:ml-1.5 [&_kbd]:font-sans">
          <Button
            className={cn(
              "p-0 text-[13px] text-muted-foreground hover:underline",
            )}
            data-open-git-log
            onClick={openGitLogTab}
            variant="ghost"
            size="default"
          >
            Open Git Log <kbd>⌥G</kbd>
          </Button>
          <Button
            className={cn(
              "p-0 text-[13px] text-muted-foreground hover:underline",
            )}
            onClick={() => setRepositoryViewMode("changes")}
            variant="ghost"
            size="default"
          >
            Commit <kbd>⌘0</kbd>
          </Button>
        </EmptyState>
      )}
      {inspectorTabs.map((tab) => {
        const key = inspectorKey(tab);
        const value = `inspector:${key}`;
        const scratch = tab.scratchId
          ? scratchFiles.find((candidate) => candidate.id === tab.scratchId)
          : undefined;
        return (
          <TabsContent
            aria-labelledby={editorTabDomId(editorTabsId, value)}
            className={`editorSurface [height:100%] [min-height:0] [min-width:0] [&[hidden]]:[display:none] editorSurface`}
            id={editorPanelDomId(editorTabsId, value)}
            keepMounted
            key={key}
            value={value}
          >
            {scratch ? (
              <ScratchEditor
                bookmarkedLines={allLineBookmarks(bookmarks)
                  .filter(
                    (bookmark) => bookmark.path === `Scratches/${scratch.name}`,
                  )
                  .map((bookmark) => bookmark.line)}
                file={scratch}
                initialColumn={tab.column}
                initialLine={tab.line}
                onChange={(content) =>
                  setScratchFiles((current) =>
                    current.map((candidate) =>
                      candidate.id === scratch.id
                        ? {
                            ...candidate,
                            content,
                            updatedAtMs: Date.now(),
                          }
                        : candidate,
                    ),
                  )
                }
                onToggleBookmark={(line, column) =>
                  requestToggleBookmark({
                    path: `Scratches/${scratch.name}`,
                    line,
                    column,
                  })
                }
              />
            ) : (
              <RepositoryInspectorDialog
                bookmarkedLines={
                  tab.path
                    ? allLineBookmarks(bookmarks)
                        .filter((bookmark) => bookmark.path === tab.path)
                        .map((bookmark) => bookmark.line)
                    : []
                }
                embedded
                initialPath={tab.path}
                initialColumn={tab.column}
                initialLine={tab.line}
                initialTab={tab.tab}
                loadBlame={sessionLoadBlame}
                loadFileHistory={sessionLoadFileHistory}
                loadTree={sessionLoadTree}
                onClose={() => void requestCloseInspector(key)}
                onDirtyChange={(dirty) => setInspectorDirty(key, dirty)}
                onToggleBookmark={(path, line, column) =>
                  requestToggleBookmark({
                    path,
                    line,
                    column,
                  })
                }
                openWorkingTreeFile={sessionOpenWorkingTreeFile}
                readFile={sessionReadFile}
                readFilePreview={sessionReadFilePreview}
                readOnly={safeMode}
                writeWorkingTreeFile={sessionWriteWorkingTreeFile}
                revision={tab.revision}
                source={tab.source}
              />
            )}
          </TabsContent>
        );
      })}
    </>
  );
}
