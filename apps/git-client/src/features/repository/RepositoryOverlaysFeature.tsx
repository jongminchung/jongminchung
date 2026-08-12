import { RepositoryOverlays } from "./overlays/RepositoryOverlays";
import { useRepositoryOverlayCapability } from "./RepositoryWorkspaceFeatureContext";

export function RepositoryOverlaysFeature() {
    const {
        chooseBookmarkMnemonic,
        createScratchFile,
        executeCommand,
        exportToHtml,
        inspector,
        openCodeIssue,
        openInspector,
        openLineBookmark,
        openStackFrame,
        productSettings,
        replaceInProjectFiles,
        repository,
        runCodeCleanup,
        runCodeInspection,
        sessionActivity,
        sessionCancelActivity,
        sessionSearchProjectText,
        vcsOperationGroups,
    } = useRepositoryOverlayCapability();
    return (
        <>
            <RepositoryOverlays
                activity={sessionActivity}
                cancelActivity={sessionCancelActivity}
                chooseBookmarkMnemonic={chooseBookmarkMnemonic}
                createScratchFile={createScratchFile}
                executeCommand={executeCommand}
                exportToHtml={exportToHtml}
                inspector={inspector}
                openCodeIssue={openCodeIssue}
                openInspector={openInspector}
                openLineBookmark={openLineBookmark}
                openStackFrame={openStackFrame}
                productSettings={productSettings}
                replaceInProjectFiles={replaceInProjectFiles}
                repository={repository}
                runCodeCleanup={runCodeCleanup}
                runCodeInspection={runCodeInspection}
                searchProjectText={sessionSearchProjectText}
                vcsOperationGroups={vcsOperationGroups}
            />
        </>
    );
}
