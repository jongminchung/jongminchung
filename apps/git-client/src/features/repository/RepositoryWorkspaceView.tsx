import { RepositoryDialogsFeature } from "./RepositoryDialogsFeature";
import { RepositoryNavigationFeature } from "./RepositoryNavigationFeature";
import { RepositoryOverlaysFeature } from "./RepositoryOverlaysFeature";
import { RepositoryStatusFeature } from "./RepositoryStatusFeature";
import { RepositoryWorkspaceFeature } from "./RepositoryWorkspaceFeature";

export function RepositoryWorkspaceView() {
  return (
    <>
      <RepositoryOverlaysFeature />
      <RepositoryNavigationFeature />
      <RepositoryWorkspaceFeature />
      <RepositoryStatusFeature />
      <RepositoryDialogsFeature />
    </>
  );
}
