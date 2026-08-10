import { useShallow } from "zustand/react/shallow";
import { useAppearance } from "../components/AppearanceProvider";
import { PushDialog } from "../components/PushDialog";
import { RepositoryDialog } from "../components/RepositoryDialog";
import { RepositoryToolDialog, type RepositoryToolKind } from "../components/RepositoryToolDialog";
import { SettingsDialog } from "../components/SettingsDialog";
import type { GitSessionController } from "../git-session/useGitSessionController";
import { useAppStore } from "./state/AppStoreProvider";

export function AppOverlays({
  openRepositoryToolSafely,
  session,
}: {
  readonly openRepositoryToolSafely: (kind: RepositoryToolKind) => Promise<void>;
  readonly session: GitSessionController;
}) {
  const { setPreference: setAppearancePreference } = useAppearance();
  const state = useAppStore(
    useShallow((store) => ({
      newProjectAppearancePreference: store.newProjectAppearancePreference,
      newProjectSettings: store.newProjectSettings,
      newProjectSettingsOpen: store.newProjectSettingsOpen,
      productSettings: store.productSettings,
      pushRequest: store.pushRequest,
      repositoryDialogMode: store.repositoryDialogMode,
      repositoryTool: store.repositoryTool,
      settingsOpen: store.settingsOpen,
      showRepositoryDialog: store.showRepositoryDialog,
      setNewProjectAppearancePreference: store.setNewProjectAppearancePreference,
      setNewProjectSettings: store.setNewProjectSettings,
      setNewProjectSettingsOpen: store.setNewProjectSettingsOpen,
      setProductSettings: store.setProductSettings,
      setPushRequest: store.setPushRequest,
      setRepositoryTool: store.setRepositoryTool,
      setSettingsOpen: store.setSettingsOpen,
      setShowRepositoryDialog: store.setShowRepositoryDialog,
    })),
  );
  const {
    newProjectAppearancePreference,
    newProjectSettings,
    newProjectSettingsOpen,
    productSettings,
    pushRequest,
    repositoryDialogMode,
    repositoryTool,
    settingsOpen,
    showRepositoryDialog,
    setNewProjectAppearancePreference,
    setNewProjectSettings,
    setNewProjectSettingsOpen,
    setProductSettings,
    setPushRequest,
    setRepositoryTool,
    setSettingsOpen,
    setShowRepositoryDialog,
  } = state;
  const handleProductSettingsChange = (settings: typeof productSettings): void =>
    setProductSettings(settings);
  const sessionCancelRepositoryCreation = session.cancelRepositoryCreation;
  const sessionCloneRepository = session.cloneRepository;
  const sessionCompareBranches = session.compareBranches;
  const sessionExecuteOperation = session.executeOperation;
  const sessionInitializeRepository = session.initializeRepository;
  const sessionLoadGitConfig = session.loadGitConfig;
  const sessionLoadMergedBranches = session.loadMergedBranches;
  const sessionLoadPushPreview = session.loadPushPreview;
  const sessionLoadSubmodules = session.loadSubmodules;
  const sessionOpenRepository = session.openRepository;
  const sessionReadIgnoreRules = session.readIgnoreRules;
  const sessionRemotes = session.remotes;
  const sessionRepository = session.repository;
  const sessionWorktrees = session.worktrees;
  const sessionWriteIgnoreRules = session.writeIgnoreRules;

  return (
    <>
      {showRepositoryDialog && (
        <RepositoryDialog
          initialMode={repositoryDialogMode}
          onCancelCreation={sessionCancelRepositoryCreation}
          onClone={async (url, path, options, onEvent) => {
            const cloned = await sessionCloneRepository(url, path, options, onEvent);
            setProductSettings(newProjectSettings);
            setAppearancePreference(newProjectAppearancePreference);
            return cloned;
          }}
          onClose={() => setShowRepositoryDialog(false)}
          onInit={async (path, bare, onEvent) => {
            const initialized = await sessionInitializeRepository(path, bare, onEvent);
            setProductSettings(newProjectSettings);
            setAppearancePreference(newProjectAppearancePreference);
            return initialized;
          }}
          onOpen={sessionOpenRepository}
        />
      )}
      {repositoryTool && sessionRepository && (
        <RepositoryToolDialog
          kind={repositoryTool}
          onClose={() => setRepositoryTool(null)}
          onCompareBranches={sessionCompareBranches}
          onLoadConfig={sessionLoadGitConfig}
          onLoadMergedBranches={sessionLoadMergedBranches}
          onLoadSubmodules={sessionLoadSubmodules}
          onOpenPush={() =>
            setPushRequest({
              localRevision: "HEAD",
              knownRewrite: false,
            })
          }
          onOpenWorktree={sessionOpenRepository}
          onOperation={sessionExecuteOperation}
          onReadIgnoreRules={sessionReadIgnoreRules}
          onWriteIgnoreRules={sessionWriteIgnoreRules}
          refs={sessionRepository.refs}
          remotes={sessionRemotes}
          repository={sessionRepository.snapshot}
          worktrees={sessionWorktrees}
        />
      )}
      {pushRequest && sessionRepository && (
        <PushDialog
          knownRewrite={pushRequest.knownRewrite}
          localRevision={pushRequest.localRevision}
          onClose={() => setPushRequest(null)}
          onLoadPreview={sessionLoadPushPreview}
          onPush={(operation) => sessionExecuteOperation(operation, true)}
          remotes={sessionRemotes}
        />
      )}
      <SettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleProductSettingsChange}
        settings={productSettings}
        onOpenRepositorySettings={() => {
          setSettingsOpen(false);
          void openRepositoryToolSafely("settings");
        }}
      />
      <SettingsDialog
        appearancePreference={newProjectAppearancePreference}
        isOpen={newProjectSettingsOpen}
        onAppearancePreferenceChange={setNewProjectAppearancePreference}
        onClose={() => setNewProjectSettingsOpen(false)}
        onSettingsChange={setNewProjectSettings}
        settings={newProjectSettings}
        showRepositorySettings={false}
        title="Settings for New Projects"
      />
    </>
  );
}
