import { useEffect } from "react";
import { electronApi } from "../../platform/electron";

export function useAppWindowLifecycle({
  repositoryName,
  restoring,
  welcomeVisible,
}: {
  readonly repositoryName: string | undefined;
  readonly restoring: boolean;
  readonly welcomeVisible: boolean;
}): void {
  useEffect(() => {
    document.title = welcomeVisible
      ? "Welcome to Git Client"
      : (repositoryName ?? "Git Client");
  }, [repositoryName, welcomeVisible]);

  useEffect(() => {
    if (restoring) return;
    const api = electronApi();
    if (api === null) return;
    void api.window.setPresentationMode(
      welcomeVisible ? "welcome" : "workspace",
    );
  }, [restoring, welcomeVisible]);
}
