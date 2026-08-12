import type {
    AsyncOperation,
    GitSessionBackend,
    GitSessionHistoryPort,
    GitSessionMutationPort,
    GitSessionQueryPort,
    GitSessionRepositoryPort,
} from "../../application/git-session/ports/GitSessionBackend";
import type { WorkspaceState } from "../../application/git-session/state/GitSessionState";
import {
    AVAILABLE_TERMINAL,
    UNAVAILABLE_TERMINAL,
} from "../../application/terminal/ports/TerminalAvailability";

const run = <T>(operation: AsyncOperation<T>): Promise<T> => operation();

const queries: GitSessionQueryPort = {
    executeRequest: (_requestKind, execute) => execute(),
    commitFiles: (live) => live(),
    diff: (live) => live(),
    tree: (live) => live(),
    files: (live) => live(),
    search: (_query, live) => live(),
    blame: (live) => live(),
    readFile: (_source, _path, live) => live(),
    readFilePreview: (_path, live) => live(),
    submoduleDiff: (_path, live) => live(),
    openWorkingTreeFile: run,
};

const mutations: GitSessionMutationPort = {
    enabled: true,
    execute: run,
    nativeOnly: (_message, live) => live(),
    createShelf: run,
    applyShelf: async (operation) => {
        await operation();
        return true;
    },
    recoveryEntries: run,
};

const history: GitSessionHistoryPort = {
    loadLog: run,
    fileHistory: (live) => live(),
    stashFiles: (live) => live(),
    stashPatch: (live) => live(),
    listLocalActivities: run,
    readLocalActivity: run,
    localDiff: (live) => live(),
    nativeOnly: (_message, live) => live(),
    loadPushPreview: (_request, live) => live(),
    loadHistoryRewritePreview: (_request, live) => live(),
};

export function createLiveGitSessionBackend({
    terminalAvailable = false,
    workspacePersistence = true,
}: {
    readonly terminalAvailable?: boolean;
    readonly workspacePersistence?: boolean;
} = {}): GitSessionBackend<WorkspaceState> {
    const persistOrIgnore = workspacePersistence ? run : async () => undefined;
    const repository: GitSessionRepositoryPort<WorkspaceState> = {
        initialWorkspace: async () => null,
        restore: persistOrIgnore,
        persist: persistOrIgnore,
        refresh: run,
        watch: run,
        assertActionsAllowed: () => undefined,
        closeResources: async (unwatch, closeTerminals) => {
            await Promise.all([unwatch(), closeTerminals()]);
        },
    };
    return {
        kind: "live",
        fixtureMode: false,
        terminal: terminalAvailable ? AVAILABLE_TERMINAL : UNAVAILABLE_TERMINAL,
        repository,
        queries,
        mutations,
        history,
    };
}

export const liveGitSessionBackend = createLiveGitSessionBackend();
