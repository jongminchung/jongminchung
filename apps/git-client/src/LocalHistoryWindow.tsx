import { AppearanceProvider } from "./components/AppearanceProvider";
import { CommandProvider } from "./components/CommandProvider";
import { GitClientTheme } from "./components/GitClientTheme";
import { LocalHistoryPanel } from "./components/LocalHistoryPanel";
import { localHistoryElectronApi } from "./platform/localHistoryElectron";

function requiredParameter(name: string): string {
    const value = new URL(window.location.href).searchParams.get(name);
    if (value === null || value.length === 0)
        throw new Error(`Missing ${name}`);
    return value;
}

export default function LocalHistoryWindow() {
    const localHistory = localHistoryElectronApi();
    const repositoryId = requiredParameter("repositoryId");
    const repositoryName = requiredParameter("repositoryName");
    const initialPath =
        new URL(window.location.href).searchParams.get("path") ?? undefined;
    document.title = initialPath
        ? `Local History: ${initialPath}`
        : `Local History: ${repositoryName}`;

    if (localHistory === null) {
        throw new Error("Local History is unavailable");
    }

    return (
        <AppearanceProvider>
            <GitClientTheme>
                <CommandProvider>
                    <main className="grid h-full min-h-0 min-w-0 grid-rows-[30px_minmax(0,1fr)] overflow-hidden bg-card">
                        <header className="flex items-center border-b border-border bg-secondary pr-3 pl-[76px] [-webkit-app-region:drag] [&_strong]:truncate [&_strong]:text-xs">
                            <strong>
                                {initialPath
                                    ? `Local History: ${initialPath}`
                                    : `Local History: ${repositoryName}`}
                            </strong>
                        </header>
                        <LocalHistoryPanel
                            initialPath={initialPath}
                            loadActivities={(
                                scope,
                                cursor,
                                limit,
                                query,
                                showSystemEvents,
                            ) =>
                                localHistory.listActivities(
                                    scope,
                                    cursor,
                                    limit,
                                    query,
                                    showSystemEvents,
                                )
                            }
                            loadActivity={(activityId) =>
                                localHistory.readActivity(
                                    repositoryId,
                                    activityId,
                                )
                            }
                            loadDiff={(activityId, path) =>
                                localHistory.readDiff(
                                    repositoryId,
                                    activityId,
                                    path,
                                )
                            }
                            mode="project"
                            onCreatePatch={(activityId, paths) =>
                                localHistory.createPatch(
                                    repositoryId,
                                    activityId,
                                    paths,
                                )
                            }
                            onPutLabel={(label) =>
                                localHistory.putLabel(repositoryId, label)
                            }
                            onRevert={(activityId, paths, includeLater) =>
                                localHistory.revert(
                                    repositoryId,
                                    activityId,
                                    paths,
                                    includeLater,
                                )
                            }
                            repositoryId={repositoryId}
                            repositoryName={repositoryName}
                        />
                    </main>
                </CommandProvider>
            </GitClientTheme>
        </AppearanceProvider>
    );
}
