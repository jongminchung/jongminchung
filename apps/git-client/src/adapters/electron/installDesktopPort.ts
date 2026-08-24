import {
  setDesktopPort,
  type DesktopPort,
} from "../../application/desktop/DesktopPort";
import { selectOfflineInspectionFiles } from "../../platform/codeAnalysis";
import { isElectronRuntime } from "../../platform/electron";
import {
  exportHtmlFiles,
  exportPatchText,
  openExternalUrl,
  readClipboardText,
  selectPatchExportPath,
  selectPatchImportPath,
  writeClipboardText,
} from "../../platform/electronActions";
import {
  readElectronSetting,
  writeElectronSettings,
} from "../../platform/electronSettings";

export function installDesktopPort(): () => void {
  const port: DesktopPort = {
    electronRuntime: isElectronRuntime(),
    exportHtmlFiles,
    exportPatchText,
    openExternalUrl,
    readClipboardText,
    readSetting: readElectronSetting,
    selectOfflineInspectionFiles,
    selectPatchExportPath,
    selectPatchImportPath,
    writeClipboardText,
    writeSettings: writeElectronSettings,
  };
  return setDesktopPort(port);
}
