import type { ReactNode } from "react";
import { RepositoryWorkspaceStoreProvider } from "../../features/repository/state/RepositoryWorkspaceStoreProvider";
import type { RepositoryWorkspaceProps } from "../../features/repository/useRepositoryWorkspaceFeature";
import { isElectronRuntime } from "../../platform/electron";

export function RepositoryWorkspaceProviders({
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
