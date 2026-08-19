import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCommands } from "../../../components/CommandProvider";
import {
    loadHostingAccounts,
    subscribeHostingAccountsChanged,
} from "../../../components/hosting-persistence";
import {
    deriveRepositoryOnboardingTasks,
    type RepositoryOnboardingTask,
} from "../../../domain/repositoryOnboarding";
import { isElectronRuntime } from "../../../platform/electron";
import { useRepositoryToolWindowCapability } from "../RepositoryWorkspaceFeatureContext";
import {
    repositoryOnboardingDismissed,
    setRepositoryOnboardingDismissed,
} from "./repositoryOnboardingPersistence";

function subscribeOnline(callback: () => void): () => void {
    window.addEventListener("online", callback);
    window.addEventListener("offline", callback);
    return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
    };
}

function browserOnline(): boolean {
    return navigator.onLine;
}

export function RepositoryOnboardingPanel({
    dismissed,
    onDismiss,
    onExecute,
    onReset,
    tasks,
}: {
    readonly dismissed: boolean;
    readonly onDismiss: () => void;
    readonly onExecute: (task: RepositoryOnboardingTask) => void;
    readonly onReset: () => void;
    readonly tasks: readonly RepositoryOnboardingTask[];
}) {
    if (dismissed) {
        return (
            <Button
                aria-label="Show Git workflow guide"
                className="absolute right-2 top-2 z-20 h-7 px-2.5 text-xs"
                onClick={onReset}
                size="sm"
                variant="outline"
            >
                Git workflow guide
            </Button>
        );
    }
    const completed = tasks.filter((task) => task.complete).length;
    return (
        <aside
            aria-label="Git workflow guide"
            className="absolute right-2 top-2 z-20 w-[min(340px,calc(100%-16px))] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg"
        >
            <header className="mb-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <strong className="block text-xs font-semibold">
                        First repository workflow
                    </strong>
                    <span className="text-[11px] text-muted-foreground">
                        {completed} of {tasks.length} steps complete
                    </span>
                </div>
                <Button
                    aria-label="Reset Git workflow guide"
                    className="h-6 px-2 text-[11px]"
                    onClick={onReset}
                    size="sm"
                    variant="ghost"
                >
                    Reset
                </Button>
                <Button
                    aria-label="Dismiss Git workflow guide"
                    className="h-6 px-2 text-[11px]"
                    onClick={onDismiss}
                    size="sm"
                    variant="ghost"
                >
                    Dismiss
                </Button>
            </header>
            <ol className="m-0 grid list-none gap-1 p-0">
                {tasks.map((task) => (
                    <li
                        className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-1"
                        key={task.id}
                    >
                        <span aria-hidden="true" className="text-xs">
                            {task.complete ? "✓" : "○"}
                        </span>
                        <span className="min-w-0">
                            <strong
                                className={cn(
                                    "block text-[11px] font-medium",
                                    task.complete &&
                                        "text-muted-foreground line-through",
                                )}
                            >
                                {task.title}
                            </strong>
                            <small className="block text-[10px] leading-4 text-muted-foreground">
                                {task.disabledReason ?? task.description}
                            </small>
                        </span>
                        {!task.complete && (
                            <Button
                                aria-label={`${task.title}: ${task.commandId}`}
                                className="h-6 px-2 text-[10px]"
                                disabled={task.disabledReason !== undefined}
                                onClick={() => onExecute(task)}
                                size="sm"
                                variant="outline"
                            >
                                Open
                            </Button>
                        )}
                    </li>
                ))}
            </ol>
        </aside>
    );
}

export function RepositoryOnboardingFeature() {
    const { execute } = useCommands();
    const { repository, safeMode, sessionRemotes } =
        useRepositoryToolWindowCapability();
    const repositoryId = repository.snapshot.id;
    const online = useSyncExternalStore(
        subscribeOnline,
        browserOnline,
        () => true,
    );
    const [dismissed, setDismissed] = useState(false);
    const [hostingAccountConnected, setHostingAccountConnected] =
        useState(false);

    useEffect(() => {
        setDismissed(repositoryOnboardingDismissed(localStorage, repositoryId));
    }, [repositoryId]);

    useEffect(() => {
        if (!isElectronRuntime()) return;
        let active = true;
        const refresh = async (): Promise<void> => {
            try {
                const accounts = await loadHostingAccounts();
                if (active) setHostingAccountConnected(accounts.length > 0);
            } catch {
                if (active) setHostingAccountConnected(false);
            }
        };
        const unsubscribe = subscribeHostingAccountsChanged(() => {
            void refresh();
        });
        void refresh();
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const updateDismissed = (next: boolean): void => {
        setRepositoryOnboardingDismissed(localStorage, repositoryId, next);
        setDismissed(next);
    };
    const tasks = deriveRepositoryOnboardingTasks({
        hostingAccountConnected,
        online,
        remotes: sessionRemotes,
        repository,
        safeMode,
    });

    return (
        <RepositoryOnboardingPanel
            dismissed={dismissed}
            onDismiss={() => updateDismissed(true)}
            onExecute={(task) => void execute(task.commandId)}
            onReset={() => updateDismissed(false)}
            tasks={tasks}
        />
    );
}
