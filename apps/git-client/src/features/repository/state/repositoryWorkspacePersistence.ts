import {
  readDesktopSetting,
  writeDesktopSettings,
} from "../../../application/desktop/DesktopPort";
import {
  parseProjectBookmarks,
  type ProjectBookmarks,
} from "../../../domain/bookmarks";
import {
  parseScratchFiles,
  SCRATCH_FILES_KEY,
  type ScratchFile,
} from "../../../domain/scratchFiles";
import {
  migrateRepositoryUiState,
  type RepositoryUiState,
} from "../../../domain/workspacePersistence";

function repositoryUiStateKey(repositoryId: string): string {
  return `repositoryUiState:${repositoryId}`;
}

function repositoryBookmarksKey(repositoryId: string): string {
  return `repositoryBookmarks:${repositoryId}`;
}

export async function hydrateScratchFiles(): Promise<readonly ScratchFile[]> {
  return parseScratchFiles(await readDesktopSetting(SCRATCH_FILES_KEY));
}

export async function persistScratchFiles(
  files: readonly ScratchFile[],
): Promise<void> {
  await writeDesktopSettings({ [SCRATCH_FILES_KEY]: files });
}

export async function hydrateRepositoryUiState(
  repositoryId: string,
): Promise<RepositoryUiState> {
  return migrateRepositoryUiState(
    await readDesktopSetting(repositoryUiStateKey(repositoryId)),
  );
}

export async function persistRepositoryUiState(
  repositoryId: string,
  state: RepositoryUiState,
): Promise<void> {
  await writeDesktopSettings({
    [repositoryUiStateKey(repositoryId)]: state,
  });
}

export async function hydrateRepositoryBookmarks(
  repositoryId: string,
  repositoryName: string,
): Promise<ProjectBookmarks> {
  return parseProjectBookmarks(
    await readDesktopSetting(repositoryBookmarksKey(repositoryId)),
    repositoryName,
  );
}

export async function persistRepositoryBookmarks(
  repositoryId: string,
  bookmarks: ProjectBookmarks,
): Promise<void> {
  await writeDesktopSettings({
    [repositoryBookmarksKey(repositoryId)]: bookmarks,
  });
}
