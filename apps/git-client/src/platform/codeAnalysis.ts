import type { OfflineInspectionFile } from "../shared/contracts/ipc";
import { electronApi } from "./electron";

export async function selectOfflineInspectionFiles(): Promise<
  readonly OfflineInspectionFile[] | null
> {
  return (await electronApi()?.analysis.openOfflineInspection()) ?? null;
}
