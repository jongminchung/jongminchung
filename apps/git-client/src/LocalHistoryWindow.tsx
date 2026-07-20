import { createGitBridge } from "./bridge/createGitBridge";
import { AppearanceProvider } from "./components/AppearanceProvider";
import { CommandProvider } from "./components/CommandProvider";
import { GitClientTheme } from "./components/GitClientTheme";
import { LocalHistoryPanel } from "./components/LocalHistoryPanel";

const git = createGitBridge();

function requiredParameter(name: string): string {
  const value = new URL(window.location.href).searchParams.get(name);
  if (value === null || value.length === 0) throw new Error(`Missing ${name}`);
  return value;
}

export default function LocalHistoryWindow() {
  const repositoryId = requiredParameter("repositoryId");
  const repositoryName = requiredParameter("repositoryName");
  const initialPath = new URL(window.location.href).searchParams.get("path") ?? undefined;
  document.title = initialPath
    ? `Local History: ${initialPath}`
    : `Local History: ${repositoryName}`;

  if (
    git.listLocalHistoryActivities === undefined ||
    git.readLocalHistoryActivity === undefined ||
    git.readLocalHistoryDiff === undefined ||
    git.revertLocalHistory === undefined ||
    git.createLocalHistoryPatch === undefined ||
    git.putLocalHistoryLabel === undefined
  ) {
    throw new Error("Local History is unavailable");
  }

  return (
    <AppearanceProvider>
      <GitClientTheme>
        <CommandProvider>
          <main className="local-history-native-window">
            <header className="local-history-native-titlebar">
              <strong>
                {initialPath ? `Local History: ${initialPath}` : `Local History: ${repositoryName}`}
              </strong>
            </header>
            <LocalHistoryPanel
              initialPath={initialPath}
              loadActivities={(scope, cursor, limit, query, showSystemEvents) =>
                git.listLocalHistoryActivities!(scope, cursor, limit, query, showSystemEvents)
              }
              loadActivity={(activityId) => git.readLocalHistoryActivity!(repositoryId, activityId)}
              loadDiff={(activityId, path) =>
                git.readLocalHistoryDiff!(repositoryId, activityId, path)
              }
              mode="project"
              onCreatePatch={(activityId, paths) =>
                git.createLocalHistoryPatch!(repositoryId, activityId, paths)
              }
              onPutLabel={(label) => git.putLocalHistoryLabel!(repositoryId, label)}
              onRevert={(activityId, paths, includeLater) =>
                git.revertLocalHistory!(repositoryId, activityId, paths, includeLater)
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
