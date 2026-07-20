import { JsonValueSchema } from "../shared/contracts/ipc";
import { electronApi } from "./electron";

export async function readElectronSetting(key: string): Promise<unknown> {
  const api = electronApi();
  if (api !== null) return api.settings.get(key);
  return null;
}

export async function writeElectronSettings(
  values: Readonly<Record<string, unknown>>,
): Promise<void> {
  const validated = Object.entries(values).map(
    ([key, value]) => [key, JsonValueSchema.parse(value)] as const,
  );
  const api = electronApi();
  if (api !== null) {
    await Promise.all(validated.map(async ([key, value]) => api.settings.set(key, value)));
    return;
  }
}

export async function exportElectronSettings(): Promise<boolean> {
  return (await electronApi()?.settings.exportArchive?.()) ?? false;
}

export async function importElectronSettings(): Promise<boolean> {
  return (await electronApi()?.settings.importArchive?.()) ?? false;
}
