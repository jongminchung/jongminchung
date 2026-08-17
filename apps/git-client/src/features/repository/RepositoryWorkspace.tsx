import type { ReactNode } from "react";
import { isElectronRuntime } from "../../platform/electron";
import { RepositoryWorkspaceFeatureProvider } from "./RepositoryWorkspaceFeatureContext";
import { RepositoryWorkspaceView } from "./RepositoryWorkspaceView";
import { RepositoryWorkspaceStoreProvider } from "./state/RepositoryWorkspaceStoreProvider";
import {
    useRepositoryWorkspaceFeature,
    type RepositoryWorkspaceProps,
} from "./useRepositoryWorkspaceFeature";

export type { RepositoryWorkspaceProps } from "./useRepositoryWorkspaceFeature";

export function RepositoryWorkspace(props: RepositoryWorkspaceProps) {
    return (
        <RepositoryWorkspaceProvider repository={props.repository}>
            <RepositoryWorkspaceContent {...props} />
        </RepositoryWorkspaceProvider>
    );
}

function RepositoryWorkspaceProvider({
    children,
    repository,
}: {
    readonly children: ReactNode;
    readonly repository: RepositoryWorkspaceProps["repository"];
}) {
    return (
        <RepositoryWorkspaceStoreProvider
            electronRuntime={isElectronRuntime()}
            repositoryId={repository.snapshot.id}
            repositoryName={repository.snapshot.name}
            selectedRef={repository.refs.find((ref) => ref.current)?.name}
        >
            {children}
        </RepositoryWorkspaceStoreProvider>
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
