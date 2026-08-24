import { useRepositoryToolWindowCapability } from "./RepositoryWorkspaceFeatureContext";
import { RepositoryStatusBar } from "./tool-windows/RepositoryStatusBar";

export function RepositoryStatusFeature() {
  const { navigationStatus, productSettings, session, terminalFocused } =
    useRepositoryToolWindowCapability();
  return (
    <>
      <RepositoryStatusBar
        navigationStatus={navigationStatus}
        productSettings={productSettings}
        session={session}
        terminalFocused={terminalFocused}
      />
    </>
  );
}
