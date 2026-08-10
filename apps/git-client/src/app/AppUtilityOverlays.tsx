import { useShallow } from "zustand/react/shallow";
import { ActivityMonitorDialog } from "../components/ActivityMonitorDialog";
import { useAppearance } from "../components/AppearanceProvider";
import { CommandLineLauncherDialog } from "../components/CommandLineLauncherDialog";
import { useCommands } from "../components/CommandProvider";
import { ConfigurationFileDialog } from "../components/ConfigurationFileDialog";
import { InvalidateCachesDialog } from "../components/InvalidateCachesDialog";
import { LeftoverDirectoriesDialog } from "../components/LeftoverDirectoriesDialog";
import { ProductHelpDialog } from "../components/ProductHelpDialog";
import { QuickSwitchSchemeDialog } from "../components/QuickSwitchSchemeDialog";
import { RepairIdeDialog } from "../components/RepairIdeDialog";
import { RunConfigurationTemplatesDialog } from "../components/RunConfigurationTemplatesDialog";
import { SavedMacrosDialog } from "../components/SavedMacrosDialog";
import { SpecialFilesDialog } from "../components/SpecialFilesDialog";
import { ToolWindowLayoutsDialog } from "../components/ToolWindowLayoutsDialog";
import { WhatsNewDialog } from "../components/WhatsNewDialog";
import type { CommandId } from "../domain/commands";
import type { ProductSettings } from "../domain/productSettings";
import type { NamedToolWindowLayout, ToolWindowLayout } from "../domain/toolWindowLayouts";
import {
  deleteLeftoverDirectories,
  loadDiagnosticSnapshot,
  listLeftoverDirectories,
  loadCommandLineLauncherInfo,
  readDiagnosticConfiguration,
  relaunchElectronApp,
  revealDiagnosticPath,
  writeDiagnosticConfiguration,
} from "../platform/electronActions";
import { clearCommitFilesCache } from "../repository/RepositoryWorkspace";
import { useAppStore } from "./state/AppStoreProvider";

export function AppUtilityOverlays({
  applyToolWindowLayout,
  onProductSettingsChange,
  reloadRepository,
  renameToolWindowLayout,
  saveToolWindowLayout,
}: {
  readonly applyToolWindowLayout: (layout: ToolWindowLayout) => void;
  readonly onProductSettingsChange: (settings: ProductSettings) => void;
  readonly reloadRepository: () => Promise<void>;
  readonly renameToolWindowLayout: (layout: NamedToolWindowLayout) => Promise<void>;
  readonly saveToolWindowLayout: (layout: NamedToolWindowLayout) => void;
}) {
  const commands = useCommands();
  const { preference: appearancePreference, setPreference: setAppearancePreference } =
    useAppearance();
  const state = useAppStore(
    useShallow((store) => ({
      activityMonitorOpen: store.activityMonitorOpen,
      commandLineLauncherOpen: store.commandLineLauncherOpen,
      diagnosticConfiguration: store.diagnosticConfiguration,
      helpOpen: store.helpOpen,
      invalidateCachesOpen: store.invalidateCachesOpen,
      layoutChooserMode: store.layoutChooserMode,
      leftoverDirectoriesOpen: store.leftoverDirectoriesOpen,
      productSettings: store.productSettings,
      quickSwitchSchemeOpen: store.quickSwitchSchemeOpen,
      repairIdeOpen: store.repairIdeOpen,
      runConfigurationTemplates: store.runConfigurationTemplates,
      runConfigurationTemplatesOpen: store.runConfigurationTemplatesOpen,
      savedMacros: store.savedMacros,
      savedMacrosOpen: store.savedMacrosOpen,
      specialFilesOpen: store.specialFilesOpen,
      toolWindowLayouts: store.toolWindowLayouts,
      whatsNewOpen: store.whatsNewOpen,
      setActivityMonitorOpen: store.setActivityMonitorOpen,
      setCommandLineLauncherOpen: store.setCommandLineLauncherOpen,
      setDiagnosticConfiguration: store.setDiagnosticConfiguration,
      setHelpOpen: store.setHelpOpen,
      setInvalidateCachesOpen: store.setInvalidateCachesOpen,
      setLayoutChooserMode: store.setLayoutChooserMode,
      setLeftoverDirectoriesOpen: store.setLeftoverDirectoriesOpen,
      setMacroRecording: store.setMacroRecording,
      setQuickSwitchSchemeOpen: store.setQuickSwitchSchemeOpen,
      setRepairIdeOpen: store.setRepairIdeOpen,
      setRunConfigurationTemplates: store.setRunConfigurationTemplates,
      setRunConfigurationTemplatesOpen: store.setRunConfigurationTemplatesOpen,
      setSavedMacros: store.setSavedMacros,
      setSavedMacrosOpen: store.setSavedMacrosOpen,
      setSpecialFilesOpen: store.setSpecialFilesOpen,
      setWhatsNewOpen: store.setWhatsNewOpen,
    })),
  );
  const {
    activityMonitorOpen,
    commandLineLauncherOpen,
    diagnosticConfiguration,
    helpOpen,
    invalidateCachesOpen,
    layoutChooserMode,
    leftoverDirectoriesOpen,
    productSettings,
    quickSwitchSchemeOpen,
    repairIdeOpen,
    runConfigurationTemplates,
    runConfigurationTemplatesOpen,
    savedMacros,
    savedMacrosOpen,
    specialFilesOpen,
    toolWindowLayouts,
    whatsNewOpen,
    setActivityMonitorOpen,
    setCommandLineLauncherOpen,
    setDiagnosticConfiguration,
    setHelpOpen,
    setInvalidateCachesOpen,
    setLayoutChooserMode,
    setLeftoverDirectoriesOpen,
    setMacroRecording,
    setQuickSwitchSchemeOpen,
    setRepairIdeOpen,
    setRunConfigurationTemplates,
    setRunConfigurationTemplatesOpen,
    setSavedMacros,
    setSavedMacrosOpen,
    setSpecialFilesOpen,
    setWhatsNewOpen,
  } = state;
  const handleProductSettingsChange = onProductSettingsChange;
  const sessionReload = reloadRepository;

  return (
    <>
      {helpOpen && <ProductHelpDialog onClose={() => setHelpOpen(false)} />}
      {whatsNewOpen && <WhatsNewDialog onClose={() => setWhatsNewOpen(false)} />}
      {activityMonitorOpen && (
        <ActivityMonitorDialog
          loadSnapshot={loadDiagnosticSnapshot}
          onClose={() => setActivityMonitorOpen(false)}
        />
      )}
      {specialFilesOpen && (
        <SpecialFilesDialog
          onClose={() => setSpecialFilesOpen(false)}
          onReveal={revealDiagnosticPath}
        />
      )}
      {leftoverDirectoriesOpen && (
        <LeftoverDirectoriesDialog
          deleteDirectories={deleteLeftoverDirectories}
          loadDirectories={listLeftoverDirectories}
          onClose={() => setLeftoverDirectoriesOpen(false)}
        />
      )}
      {commandLineLauncherOpen && (
        <CommandLineLauncherDialog
          loadInfo={loadCommandLineLauncherInfo}
          onClose={() => setCommandLineLauncherOpen(false)}
        />
      )}
      {diagnosticConfiguration && (
        <ConfigurationFileDialog
          description={diagnosticConfiguration.description}
          load={() => readDiagnosticConfiguration(diagnosticConfiguration.kind)}
          onClose={() => setDiagnosticConfiguration(null)}
          save={(content) => writeDiagnosticConfiguration(diagnosticConfiguration.kind, content)}
          title={diagnosticConfiguration.title}
        />
      )}
      {quickSwitchSchemeOpen && (
        <QuickSwitchSchemeDialog
          appearancePreference={appearancePreference}
          onAppearancePreferenceChange={setAppearancePreference}
          onClose={() => setQuickSwitchSchemeOpen(false)}
          onSettingsChange={handleProductSettingsChange}
          settings={productSettings}
        />
      )}
      {repairIdeOpen && (
        <RepairIdeDialog
          onClose={() => setRepairIdeOpen(false)}
          onContinueToInvalidate={() => {
            setRepairIdeOpen(false);
            setInvalidateCachesOpen(true);
          }}
          onRepair={async () => {
            clearCommitFilesCache();
            window.dispatchEvent(new CustomEvent("git-client:repair-indexes"));
            await sessionReload();
          }}
        />
      )}
      {invalidateCachesOpen && (
        <InvalidateCachesDialog
          onClose={() => setInvalidateCachesOpen(false)}
          onInvalidateAndRestart={() => relaunchElectronApp(true)}
          onRestart={() => relaunchElectronApp(false)}
        />
      )}
      {runConfigurationTemplatesOpen && (
        <RunConfigurationTemplatesDialog
          onChange={setRunConfigurationTemplates}
          onClose={() => setRunConfigurationTemplatesOpen(false)}
          templates={runConfigurationTemplates}
        />
      )}
      {savedMacrosOpen && (
        <SavedMacrosDialog
          macros={savedMacros}
          onClose={() => setSavedMacrosOpen(false)}
          onDelete={(macroId) =>
            setSavedMacros((current) => current.filter((macro) => macro.id !== macroId))
          }
          onPlay={async (macro) => {
            setSavedMacrosOpen(false);
            setMacroRecording(false);
            for (const commandId of macro.commandIds) {
              await commands.execute(commandId as CommandId);
            }
          }}
        />
      )}
      {layoutChooserMode && (
        <ToolWindowLayoutsDialog
          layouts={toolWindowLayouts}
          onChoose={(layout) => {
            const mode = layoutChooserMode;
            setLayoutChooserMode(undefined);
            if (mode === "restore") {
              applyToolWindowLayout(layout.state);
            } else if (mode === "save") {
              saveToolWindowLayout(layout);
            } else {
              void renameToolWindowLayout(layout);
            }
          }}
          onClose={() => setLayoutChooserMode(undefined)}
          title={
            layoutChooserMode === "restore"
              ? "Restore Layout"
              : layoutChooserMode === "save"
                ? "Save Changes in Layout"
                : "Rename Layout"
          }
        />
      )}
    </>
  );
}
