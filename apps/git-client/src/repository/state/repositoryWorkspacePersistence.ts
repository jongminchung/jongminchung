import { parseProjectBookmarks, type ProjectBookmarks } from "../../domain/bookmarks";
import { parseScratchFiles, SCRATCH_FILES_KEY, type ScratchFile } from "../../domain/scratchFiles";
import {
  migrateRepositoryUiState,
  type RepositoryUiState,
} from "../../domain/workspacePersistence";
import { readElectronSetting, writeElectronSettings } from "../../platform/electronSettings";

function repositoryUiStateKey(repositoryId: string): string {
  return `repositoryUiState:${repositoryId}`;
}

function repositoryBookmarksKey(repositoryId: string): string {
  return `repositoryBookmarks:${repositoryId}`;
}

export async function hydrateScratchFiles(): Promise<readonly ScratchFile[]> {
  return parseScratchFiles(await readElectronSetting(SCRATCH_FILES_KEY));
}

export async function persistScratchFiles(files: readonly ScratchFile[]): Promise<void> {
  await writeElectronSettings({ [SCRATCH_FILES_KEY]: files });
}

export async function hydrateRepositoryUiState(repositoryId: string): Promise<RepositoryUiState> {
  return migrateRepositoryUiState(await readElectronSetting(repositoryUiStateKey(repositoryId)));
}

export async function persistRepositoryUiState(
  repositoryId: string,
  state: RepositoryUiState,
): Promise<void> {
  await writeElectronSettings({ [repositoryUiStateKey(repositoryId)]: state });
}

export async function hydrateRepositoryBookmarks(
  repositoryId: string,
  repositoryName: string,
): Promise<ProjectBookmarks> {
  return parseProjectBookmarks(
    await readElectronSetting(repositoryBookmarksKey(repositoryId)),
    repositoryName,
  );
}

export async function persistRepositoryBookmarks(
  repositoryId: string,
  bookmarks: ProjectBookmarks,
): Promise<void> {
  await writeElectronSettings({ [repositoryBookmarksKey(repositoryId)]: bookmarks });
}
