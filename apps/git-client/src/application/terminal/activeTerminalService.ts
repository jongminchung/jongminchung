import type {
    RepositoryId,
    TerminalEvent,
} from "../../shared/contracts/model/index";
import type { TerminalSessionCreateOptions } from "./TerminalService";
import { TerminalService } from "./TerminalService";

let activeService: TerminalService | undefined;

function getTerminalService(): TerminalService {
    if (activeService === undefined) {
        throw new Error("Terminal service was not installed");
    }
    return activeService;
}

export function installTerminalService(service: TerminalService): () => void {
    const previous = activeService;
    activeService = service;
    return () => {
        if (activeService === service) activeService = previous;
    };
}

export const terminalService = {
    subscribe: (listener: () => void): (() => void) =>
        getTerminalService().subscribe(listener),
    snapshot: (): number => getTerminalService().snapshot(),
    sessions: (repositoryId: RepositoryId) =>
        getTerminalService().sessions(repositoryId),
    events: (key: string): readonly TerminalEvent[] =>
        getTerminalService().events(key),
    subscribeEvents: (
        key: string,
        listener: (event: TerminalEvent) => void,
    ): (() => void) => getTerminalService().subscribeEvents(key, listener),
    listLaunchTargets: () => getTerminalService().listLaunchTargets(),
    create: (
        repositoryId: RepositoryId,
        options?: TerminalSessionCreateOptions,
    ): Promise<string> => getTerminalService().create(repositoryId, options),
    write: (key: string, data: string): Promise<void> =>
        getTerminalService().write(key, data),
    resize: (key: string, cols: number, rows: number): Promise<void> =>
        getTerminalService().resize(key, cols, rows),
    close: (key: string): Promise<void> => getTerminalService().close(key),
    closeRepository: (repositoryId: RepositoryId): Promise<void> =>
        getTerminalService().closeRepository(repositoryId),
    count: (repositoryId: RepositoryId): number =>
        getTerminalService().count(repositoryId),
    restore: (repositoryId: RepositoryId): Promise<void> =>
        getTerminalService().restore(repositoryId),
} as const;
