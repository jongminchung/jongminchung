import { Tabs } from "@jongminchung/ui/components/tabs";
import type { CSSProperties } from "react";
import { RepositoryEditorFeature } from "./editor/RepositoryEditorFeature";
import { RepositoryEditorSurface } from "./editor/RepositoryEditorSurface";
import { RepositoryEditorTabsFeature } from "./editor/RepositoryEditorTabsFeature";
import { RepositoryOnboardingFeature } from "./onboarding/RepositoryOnboardingFeature";
import {
    useRepositoryReviewCapability,
    useRepositoryToolWindowCapability,
} from "./RepositoryWorkspaceFeatureContext";
import { RepositoryReviewFeature } from "./review/RepositoryReviewFeature";
import { RepositoryNotificationFeature } from "./tool-windows/RepositoryNotificationFeature";
import { RepositorySideToolWindowsFeature } from "./tool-windows/RepositorySideToolWindowsFeature";
import { RepositoryToolStripeFeature } from "./tool-windows/RepositoryToolStripeFeature";
import { RepositoryToolWindows } from "./tool-windows/RepositoryToolWindows";
import { RepositoryChangesFeature } from "./vcs/RepositoryChangesFeature";
import { RepositoryVcsFeature } from "./vcs/RepositoryVcsFeature";

export function RepositoryWorkspaceFeature() {
    const { historyReviewWidth } = useRepositoryReviewCapability();
    const {
        activeEditorTabValue,
        hasEditorTabs,
        leftToolWindowOpen,
        maximizedToolWindow,
        repositoryViewMode,
        sessionLoading,
        setActiveInspectorKey,
        setActiveLogTabId,
        setRepositoryViewMode,
        sideToolWindowWidth,
    } = useRepositoryToolWindowCapability();

    return (
        <Tabs
            className="contents"
            onValueChange={(value) => {
                if (value.startsWith("log:")) {
                    setActiveLogTabId(value.slice("log:".length));
                    setActiveInspectorKey(undefined);
                    setRepositoryViewMode("history");
                    return;
                }
                if (value.startsWith("inspector:")) {
                    setActiveInspectorKey(value.slice("inspector:".length));
                }
            }}
            value={hasEditorTabs ? activeEditorTabValue : null}
        >
            <RepositoryEditorTabsFeature />
            <RepositoryToolWindows loading={sessionLoading}>
                <RepositoryToolStripeFeature />
                <RepositoryEditorSurface
                    maximizedToolWindow={maximizedToolWindow}
                >
                    <div
                        className={`${`workbenchContent [display:grid] [gap:3px] [grid-template-columns:minmax(0,_1fr)] [min-height:0] [min-width:0] [html[data-distraction-free-mode=true]_&]:grid-cols-[minmax(0,1fr)]! [html[data-presentation-mode=true]_&]:grid-cols-[minmax(0,1fr)]! workbenchContent`} ${leftToolWindowOpen ? `projectToolOpen [grid-template-columns:minmax(302px,_var(--side-tool-window-width,_clamp(352px,_32.7vw,_458px)))_minmax(0,_1fr)] projectToolOpen` : ""} ${maximizedToolWindow === "project" || maximizedToolWindow === "bookmarks" ? `maximizedSideTool [grid-template-columns:minmax(0,_1fr)] [&>_[data-workspace-main]]:[display:none] maximizedSideTool` : ""}`}
                        style={
                            {
                                "--side-tool-window-width": `${repositoryViewMode === "changes" ? 302 : sideToolWindowWidth}px`,
                                "--details-pane-width": `${historyReviewWidth}px`,
                            } as CSSProperties
                        }
                    >
                        <RepositorySideToolWindowsFeature />
                        {repositoryViewMode === "changes" && (
                            <RepositoryChangesFeature />
                        )}
                        <div
                            className={`${`activeWorkspace [background:var(--card)] rounded-lg [display:grid] [min-height:0] [min-width:0] [overflow:hidden] [padding-top:32px] [position:relative] activeWorkspace rounded-lg`} ${!hasEditorTabs ? `activeWorkspaceNoTabs [padding-top:0] activeWorkspaceNoTabs` : ""}`}
                            data-workspace-main
                        >
                            <RepositoryOnboardingFeature />
                            <RepositoryReviewFeature />
                            <RepositoryEditorFeature />
                        </div>
                    </div>
                    <RepositoryVcsFeature />
                </RepositoryEditorSurface>
                <RepositoryNotificationFeature />
            </RepositoryToolWindows>
        </Tabs>
    );
}
