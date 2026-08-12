import { RepositoryWorkspaceFeatureProvider } from "../../features/repository/RepositoryWorkspaceFeatureContext";
import { RepositoryWorkspaceView } from "../../features/repository/RepositoryWorkspaceView";
import {
    useRepositoryWorkspaceFeature,
    type RepositoryWorkspaceProps,
} from "../../features/repository/useRepositoryWorkspaceFeature";
import { RepositoryWorkspaceProviders } from "../providers/RepositoryWorkspaceProviders";

export function RepositoryWorkspace(props: RepositoryWorkspaceProps) {
    return (
        <RepositoryWorkspaceProviders repository={props.repository}>
            <RepositoryWorkspaceContent {...props} />
        </RepositoryWorkspaceProviders>
    );
}

function RepositoryWorkspaceContent(props: RepositoryWorkspaceProps) {
    const model = useRepositoryWorkspaceFeature(props);
    return (
        <RepositoryWorkspaceFeatureProvider model={model}>
            <RepositoryWorkspaceView />
        </RepositoryWorkspaceFeatureProvider>
    );
}
