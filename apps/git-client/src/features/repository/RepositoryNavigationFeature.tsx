import { useRepositoryToolWindowCapability } from "./RepositoryWorkspaceFeatureContext";
import { RepositoryNavigationSurface } from "./tool-windows/RepositoryNavigationSurface";

export function RepositoryNavigationFeature() {
    const { navigationStatus, productSettings } =
        useRepositoryToolWindowCapability();
    return (
        <>
            <RepositoryNavigationSurface
                navigationStatus={navigationStatus}
                productSettings={productSettings}
            />
        </>
    );
}
